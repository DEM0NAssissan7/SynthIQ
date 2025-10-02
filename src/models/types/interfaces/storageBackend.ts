export interface StorageBackend {
  readonly name: string;
  getItem: (key: string) => Promise<string>;
  setItem: (key: string, value: string) => Promise<void>;
  clear: () => void;
}
