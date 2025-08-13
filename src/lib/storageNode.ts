import Subscribable from "../models/subscribable";
import type { SubscriptionCallback } from "../models/types/subscriptionCallback";

const appID = "synthiq";
const storageBackend = {
  // Allow for use with alternative storage APIs
  getItem: (key: string) => {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem(key);
    } else {
      console.error(
        "StorageNode: Something went wrong with the storage backend (getItem)"
      );
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, value);
    } else {
      console.error(
        "StorageNode: Something went wrong with the storage backend (setItem)"
      );
    }
  },
};

type ReadHandler = (val: string) => any;
type WriteHandler = (val: any) => string;

const defaultReadHandler: ReadHandler = JSON.parse;
const defaultWriteHandler: WriteHandler = JSON.stringify;

export let nodes: StorageNode[] = [];

class StorageEntry extends Subscribable {
  id: string;
  private nodeName: string;
  private writeHandler: WriteHandler;
  private readHandler: ReadHandler;
  private defaultValue: any;

  value: any;

  constructor(
    id: string,
    nodeName: string,
    defaultValue: any,
    writeHandler: WriteHandler,
    readHandler: ReadHandler
  ) {
    super();
    this.id = id;
    this.nodeName = nodeName;
    this.defaultValue = defaultValue;
    this.value = defaultValue;
    this.writeHandler = writeHandler;
    this.readHandler = readHandler;
  }

  // Basic, fast, in-memory frontend
  get() {
    return this.value;
  }
  set(value: any) {
    this.value = value;
    this.write();
    this.notify();
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
        `StorageEntry: did not find an entry in localstorage for ${this.getLocalstorageId()}. Creating new entry...`
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
        `StorageEntry[${this.getLocalstorageId()}]: Read handler is invalid: ${e}`
      );
    }
  }
  write() {
    try {
      this.writeToStorage(this.export());
    } catch (e) {
      console.error(e);
      throw new Error(
        `StorageEntry[${this.getLocalstorageId()}]: Write handler is invalid: ${e}`
      );
    }
  }

  // Handler Abstraction
  export() {
    return this.writeHandler(this.value);
  }
  import(str: string) {
    return (this.value = this.readHandler(str));
  }

  // Storage API
  private writeToStorage(value: any) {
    if (typeof value === "string") {
      storageBackend.setItem(this.getLocalstorageId(), value);
    } else {
      throw new Error(
        `StorageEntry[${this.getLocalstorageId()}]: Cannot write non-string to localstorage.`
      );
    }
  }
  private getFromStorage() {
    let retval: any;
    retval = storageBackend.getItem(this.getLocalstorageId());
    if (retval === null)
      throw new Error(
        `StorageEntry[${this.getLocalstorageId()}]: Failed to retrieve key`
      );
    return retval;
  }
  private getLocalstorageId() {
    return `${appID}.${this.nodeName}.${this.id}`;
  }
}

class StorageNode extends Subscribable {
  name: string;
  private entries: StorageEntry[] = [];
  constructor(name: string, skipRegister: boolean = false) {
    super();
    this.name = name;
    if (!skipRegister) nodes.push(this);
  }

  // Bread and butter
  set(id: string, value: any): void {
    this.getEntryById(id).set(value);
    this.notify();
  }
  get(id: string): any {
    return this.getEntryById(id).get();
  }
  add(
    id: string,
    defaultValue: any,
    readHandler: ReadHandler = defaultReadHandler,
    writeHandler: WriteHandler = defaultWriteHandler
  ): void {
    try {
      this.getEntryById(id); // Try to see if it already exists
    } catch {
      const entry = new StorageEntry(
        id,
        this.name,
        defaultValue,
        writeHandler,
        readHandler
      );
      entry.read(); // Automatically pull value from storage
      this.entries.push(entry);
      return;
    }
    throw new Error(
      `StorageNode[${this.name}]: Cannot add entry - entry with id '${id}' already exists.`
    );
  }

  // Resetting
  reset(id: string): void {
    this.getEntryById(id).reset();
  }
  reset_all(): void {
    this.entries.forEach((e) => e.reset());
  }

  // Manual Entry Storage Control
  read(id: string): void {
    this.getEntryById(id).read();
  }
  write(id: string): void {
    this.getEntryById(id).write();
  }
  writeAll(): void {
    this.entries.forEach((e) => e.write());
  }

  // Entry Subscriptions
  subscribeNode(id: string, callback: SubscriptionCallback): void {
    this.getEntryById(id).subscribe(callback);
  }
  unsubscribeNode(id: string, callback: SubscriptionCallback): void {
    this.getEntryById(id).unsubscribe(callback);
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
          console.warn(`Couldn't import ${this.name}.${id}: ${e}`);
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
