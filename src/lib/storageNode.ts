const storageBackend = {
  // Allow for use with alternative storage APIs
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};

type ReadHandler = (val: string) => any;
type WriteHandler = (val: any) => string;
type SubscriptionCallback = (val: any) => void;

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
    this.runSubscriptions();
  }
  reset() {
    this.set(this.defaultValue);
  }

  // Storage Abstraction (through handlers and try/catch)
  read() {
    let val = this.getFromStorage();
    if (val === null) {
      console.warn(
        `StorageEntry: did not find an entry in localstorage for ${this.getLocalstorageId()}. Creating new entry...`
      );
      val = this.defaultValue;
    } else {
      try {
        this.import(val);
      } catch (e) {
        throw new Error(
          `StorageEntry[${this.getLocalstorageId()}]: Read handler is invalid: ${e}`
        );
      }
    }
    this.value = val;
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
    if (typeof value === "string")
      storageBackend.setItem(this.getLocalstorageId(), value);
    else {
      console.log(value);
      throw new Error(
        `StorageEntry[${this.getLocalstorageId()}]: Cannot write non-string to localstorage.`
      );
    }
  }
  private getFromStorage() {
    return storageBackend.getItem(this.getLocalstorageId());
  }
  getLocalstorageId() {
    return `${this.nodeName}.${this.id}`;
  }

  // Subscriptions
  subscribe(callback: SubscriptionCallback) {
    this.subscriptions.push(callback);
  }
  runSubscriptions() {
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
  private entries: StorageEntry[] = [];
  constructor(name: string) {
    this.name = name;
  }

  // Bread and butter
  set(id: string, value: any): void {
    return this.getEntryById(id).set(value);
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
      this.getEntryById(id);
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

  // Callbacks
  subscribe(id: string, callback: SubscriptionCallback): void {
    this.getEntryById(id).subscribe(callback);
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
