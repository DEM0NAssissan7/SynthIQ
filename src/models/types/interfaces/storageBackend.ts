export interface StorageBackend {
  readonly name: string;
  getItem: (key: string) => string;
  setItem: (key: string, value: string) => void;
  clear: () => void;
}
