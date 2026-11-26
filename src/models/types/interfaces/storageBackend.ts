export interface StorageBackend {
  readonly name: string;
  getItem: (key: string) => string;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  get size(): number; // size in bytes
  clear: () => void;
}
