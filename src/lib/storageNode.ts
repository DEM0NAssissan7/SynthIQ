import { useState, useEffect } from "react";
import type {
  Deserializer,
  Serializer,
  SubscriptionCallback,
} from "../models/types/types";
import StorageBackends from "../registries/storageBackends";

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

const appID = "pulseiq";
const storageBackend = StorageBackends.getDefault();
function useStorageState<T>(entry: StorageEntry): [T, (v: T) => void] {
  const [value, setValue] = useState(entry.get() as T);

  useEffect(() => {
    const callback = (newVal: T) => setValue(newVal);
    entry.subscribe(callback);
    return () => entry.unsubscribe(callback);
  }, [entry]);

  const updateValue = (v: T) => {
    entry.set(v);
  };

  return [value as T, updateValue];
}

const defaultDeserializer: Deserializer<any> = JSON.parse;
const defaultSerializer: Serializer<any> = JSON.stringify;

export let nodes: StorageNode[] = [];

class StorageEntry {
  id: string;
  private nodeName: string;
  private serializer: Serializer<any>;
  private deserializer: Deserializer<any>;
  private defaultValue: any;

  value: any;
  subscriptions: SubscriptionCallback<any>[] = [];

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
  read(): void {
    let val: string;
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
  import(str: string) {
    return (this.value = this.deserializer(str));
  }

  // Storage API
  private writeToStorage(value: any) {
    if (typeof value === "string") {
      storageBackend.setItem(this.getStorageKey(), value);
    } else {
      throw new Error(
        `StorageEntry[${this.getStorageKey()}]: Cannot write non-string to storage.`
      );
    }
  }
  private getFromStorage() {
    let retval: any;
    retval = storageBackend.getItem(this.getStorageKey());
    if (retval === null)
      throw new Error(
        `StorageEntry[${this.getStorageKey()}]: Failed to retrieve key`
      );
    return retval;
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
