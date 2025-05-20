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
type SubscriptionCallback = (val: any) => void;
type GeneralSubscriptionCallback = () => void;

const defaultReadHandler: ReadHandler = JSON.parse;
const defaultWriteHandler: WriteHandler = JSON.stringify;

class StorageEntry {
  id: string;
  private nodeName: string;
  private writeHandler: WriteHandler;
  private readHandler: ReadHandler;
  private defaultValue: any;

  value: any;
  subscriptions: SubscriptionCallback[] = [];

  constructor(
    id: string,
    nodeName: string,
    defaultValue: any,
    writeHandler: WriteHandler,
    readHandler: ReadHandler
  ) {
    this.id = id;
    this.nodeName = nodeName;
    this.defaultValue = defaultValue;
    this.value = defaultValue;
    this.writeHandler = writeHandler;
    this.readHandler = readHandler;
  }

  // Basic, fast frontend
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
    this.value = this.readHandler(str);
  }

  // Storage API
  private writeToStorage(value: any) {
    if (typeof value === "string") {
      storageBackend.setItem(this.getLocalstorageId(), value);
    } else {
      console.log(value);
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

  // Subscriptions
  subscribe(callback: SubscriptionCallback) {
    this.subscriptions.push(callback);
  }
  unsubscribe(callback: SubscriptionCallback) {
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
          `StorageEntry[${this.getLocalstorageId()}]: Subscription callback failed.`
        );
        throw new Error(e);
      }
    });
  }
}

class StorageNode {
  name: string;
  generalSubscriptions: GeneralSubscriptionCallback[] = [];
  private entries: StorageEntry[] = [];
  constructor(name: string) {
    this.name = name;
  }

  // Bread and butter
  set(id: string, value: any): void {
    this.getEntryById(id).set(value);
    this.notifyGeneral();
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

  // Entry Subscriptions
  subscribe(id: string, callback: SubscriptionCallback): void {
    this.getEntryById(id).subscribe(callback);
  }
  unsubscribe(id: string, callback: SubscriptionCallback): void {
    this.getEntryById(id).unsubscribe(callback);
  }

  // General Subscriptions
  subscribeGeneral(callback: GeneralSubscriptionCallback): void {
    this.generalSubscriptions.push(callback);
  }
  unsubscribeGeneral(callback: GeneralSubscriptionCallback) {
    this.generalSubscriptions = this.generalSubscriptions.filter(
      (subscriber) => subscriber !== callback
    );
  }
  private notifyGeneral() {
    this.generalSubscriptions.forEach((callback) => callback());
  }

  // Exporting and importing
  static export(node: StorageNode): string {
    // TODO
    node;
    return "";
  }
  static import(str: string): StorageNode {
    // TODO
    let obj = JSON.parse(str);
    let node = new StorageNode(obj.name);
    return node;
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
