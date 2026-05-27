import { useEffect, useRef, useReducer, useCallback } from "react";
import type {
  Deserializer,
  JSONValue,
  Serializer,
  SubscriptionCallback,
} from "../models/types/types";
import StorageBackends from "../registries/storageBackends";
import pako from "pako";

// Compression marker — JSON never starts with "~", so this is an unambiguous signal.
// Values stored with this prefix are deflated + base64-encoded.
const COMPRESS_PREFIX = "~z";

function isCompressed(stored: string): boolean {
  return stored.startsWith(COMPRESS_PREFIX);
}

function compressValue(value: JSONValue): string {
  const json = JSON.stringify(value);
  // If the JSON is tiny, compression can bloat it — skip.
  if (json.length < 256) return json;
  const deflated = pako.deflate(json, { level: 9 });
  // Base64-encode the binary — chunked to avoid call-stack overflow on large arrays
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < deflated.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...deflated.subarray(i, Math.min(i + chunkSize, deflated.length)),
    );
  }
  const encoded = btoa(binary);
  // Only store compressed if it actually saved space
  if (encoded.length + COMPRESS_PREFIX.length >= json.length) return json;
  return COMPRESS_PREFIX + encoded;
}

function decompressValue(stored: string): JSONValue {
  if (!isCompressed(stored)) return JSON.parse(stored);
  const encoded = stored.slice(COMPRESS_PREFIX.length);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = pako.inflate(bytes, { to: "string" });
  return JSON.parse(json);
}

export interface KeyInterface<T> {
  get value(): T;
  set value(a: T);
  write: () => void;
  reset: () => void;
  subscribe: (callback: SubscriptionCallback<T>) => void;
  unsubscribe: (callback: SubscriptionCallback<T>) => void;
  notify: () => void;
  useState: () => [T, (v: T) => void];
}

const appID = "synthiq";
const storageBackend = StorageBackends.getDefault();
function useStorageState<T>(entry: StorageEntry): [T, (v: T) => void] {
  // Keep the latest value in a ref (doesn't cause renders by itself)
  const valueRef = useRef<T>(entry.get() as T);

  // Use a reducer as a "version" to force rerenders on every emission
  const [, bump] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    let isCalling = false;
    const onChange = (newVal: T) => {
      if (!isCalling) {
        isCalling = true;
        valueRef.current = newVal; // update, even if reference is the same
        bump(); // force a rerender every time
      }
      isCalling = false;
    };
    entry.subscribe(onChange);
    return () => entry.unsubscribe(onChange);
  }, [entry]);

  const updateValue = useCallback(
    (v: T) => {
      entry.set(v); // this will eventually call our subscriber
    },
    [entry]
  );

  return [valueRef.current as T, updateValue];
}

const defaultDeserializer: Deserializer<any> = (a: JSONValue) => a;
const defaultSerializer: Serializer<any> = (a: JSONValue) => a;

export let nodes: StorageNode[] = [];

class StorageEntry {
  id: string;
  private nodeName: string;
  private serializer: Serializer<any>;
  private deserializer: Deserializer<any>;
  private defaultValue: any;

  value: any;
  subscriptions: SubscriptionCallback<any>[] = [];
  /** Tracks whether the last read was uncompressed old data — triggers re-compression */
  private _needsCompressionMigration: boolean = false;

  constructor(
    id: string,
    nodeName: string,
    defaultValue: any,
    serializer: Serializer<any>,
    deserializer: Deserializer<any>
  ) {
    this.id = id;
    this.nodeName = nodeName;
    this.defaultValue = defaultValue;
    this.value = defaultValue;
    this.serializer = serializer;
    this.deserializer = deserializer;
  }

  // Basic, fast, in-memory frontend
  get() {
    return this.value;
  }
  set(value: any) {
    this.value = value; // Update in-memory cache value
    this.write(); // Write to storage
    this.notify(); // Notify subscribers
  }
  reset() {
    this.set(this.defaultValue);
  }

  // Storage Abstraction (through handlers and try/catch)
  read() {
    let val: JSONValue;
    try {
      val = this.getFromStorage();
    } catch {
      console.warn(
        `StorageEntry: did not find an entry in storage for ${this.getStorageKey()}. Creating new entry...`
      );
      this.write();
      return;
    }

    // Import value from storage
    try {
      this.import(val);
      // One-time migration: if the stored data was uncompressed (pre-pako), re-write compressed
      if (this._needsCompressionMigration) {
        this._needsCompressionMigration = false;
        this.write();
      }
    } catch (e) {
      console.error(e);
      throw new Error(
        `StorageEntry[${this.getStorageKey()}]: Deserializer is invalid: ${e}`
      );
    }
  }
  write() {
    try {
      this.writeToStorage(this.export());
      this.notify();
    } catch (e) {
      console.error(e);
      throw new Error(
        `StorageEntry[${this.getStorageKey()}]: Serializer is invalid: ${e}`
      );
    }
  }

  // Serializer Abstraction
  export() {
    return this.serializer(this.value);
  }
  import(object: JSONValue) {
    return (this.value = this.deserializer(object));
  }

  // Storage API
  private writeToStorage(value: JSONValue) {
    storageBackend.setItem(this.getStorageKey(), compressValue(value));
  }
  private getFromStorage(): JSONValue {
    let retval: any;
    const raw = storageBackend.getItem(this.getStorageKey());
    retval = raw;
    if (retval === null)
      throw new Error(
        `StorageEntry[${this.getStorageKey()}]: Failed to retrieve key`
      );
    this._needsCompressionMigration = !isCompressed(retval);
    return decompressValue(retval);
  }
  private getStorageKey() {
    return `${appID}.${this.nodeName}.${this.id}`;
  }

  // Key interface
  getKeyInterface<T>(): KeyInterface<T> {
    const self = this;
    return {
      get value() {
        return self.get();
      },
      set value(val: T) {
        self.set(val);
      },
      write: () => self.write(),
      reset: () => self.reset(),
      subscribe: (callback) => self.subscribe(callback),
      unsubscribe: (callback) => self.unsubscribe(callback),
      notify: () => self.notify(),
      useState: () => useStorageState<T>(self),
    };
  }

  // Subscriptions
  subscribe(callback: SubscriptionCallback<any>) {
    this.subscriptions.push(callback);
  }
  unsubscribe(callback: SubscriptionCallback<any>) {
    this.subscriptions = this.subscriptions.filter(
      (subscriber) => subscriber !== callback
    );
  }
  private notify() {
    this.subscriptions.forEach((callback) => {
      try {
        callback(this.value);
      } catch (e: any) {
        console.error(
          `StorageEntry[${this.getStorageKey()}]: Subscription callback failed.`
        );
        throw new Error(e);
      }
    });
  }
}

class StorageNode {
  name: string;
  private entries: StorageEntry[] = [];
  constructor(name: string, skipRegister: boolean = false) {
    this.name = name;
    if (!skipRegister) nodes.push(this);
  }

  // Bread and butter
  add<T>(
    id: string,
    defaultValue: T,
    serializer: Serializer<T> = defaultSerializer,
    deserializer: Deserializer<T> = defaultDeserializer
  ): KeyInterface<T> {
    try {
      return this.getEntryById(id).getKeyInterface<T>(); // Try to see if it already exists
    } catch {
      const entry = new StorageEntry(
        id,
        this.name,
        defaultValue,
        serializer,
        deserializer
      );
      entry.read(); // Automatically pull value from storage
      this.entries.push(entry);
      return entry.getKeyInterface<T>();
    }
  }

  // Resetting
  reset_all(): void {
    this.entries.forEach((e) => e.reset());
  }

  // Exporting and importing
  export(): any {
    let keys: any[] = [];
    this.entries.forEach((e) => {
      keys.push({
        id: e.id,
        value: e.export(),
      });
    });
    return {
      name: this.name,
      keys,
    };
  }
  import(o: any): void {
    if (this.name === o.name) {
      let keys = o.keys;
      keys.forEach((k: any) => {
        let id = k.id;
        try {
          let entry = this.getEntryById(id);
          const value = entry.import(k.value);
          entry.set(value);
        } catch (e) {
          console.warn(`Couldn't import ${appID}.${this.name}.${id}: ${e}`);
        }
      });
    }
  }

  // ID abstraction
  private getEntryById(id: string): StorageEntry {
    for (const entry of this.entries) {
      if (entry.id === id) return entry;
    }
    throw new Error(
      `StorageNode[${this.name}]: No entry with id '${id}' exists.`
    );
  }
}

export default StorageNode;
