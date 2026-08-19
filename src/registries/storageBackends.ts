import { KeyDoesNotExistError } from "../models/types/errors";
import type { StorageBackend } from "../models/types/interfaces/storageBackend";

const memoryStorage = new Map<string, string>();

namespace StorageBackends {
  export const webLocal: StorageBackend = {
    name: "localStorage",
    getItem: (key: string): string => {
      if (typeof window !== "undefined" && window.localStorage) {
        const retval = localStorage.getItem(key);
        if (retval === null) throw new KeyDoesNotExistError();
        return retval;
      } else {
        const val = memoryStorage.get(key);
        if (val === undefined || val === null) throw new KeyDoesNotExistError();
        return val;
      }
    },
    setItem: (key: string, value: string): void => {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, value);
      } else {
        memoryStorage.set(key, value);
      }
    },
    get size(): number {
      if (typeof window !== "undefined" && window.localStorage) {
        let total = 0;
        for (const key in localStorage) {
          if (!Object.prototype.hasOwnProperty.call(localStorage, key)) {
            continue;
          }
          total += (localStorage[key].length + key.length) * 2;
        }
        return total;
      }
      let total = 0;
      for (const [k, v] of memoryStorage.entries()) {
        total += (k.length + v.length) * 2;
      }
      return total;
    },
    clear: (): void => {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.clear();
      } else {
        memoryStorage.clear();
      }
    },
  };

  export function getDefault(): StorageBackend {
    return StorageBackends.webLocal;
  }
}

export default StorageBackends;
