import { KeyDoesNotExistError } from "../models/types/errors";
import type { StorageBackend } from "../models/types/interfaces/storageBackend";

const memoryStorage = new Map<string, string>();

namespace StorageBackends {
  export const webLocal: StorageBackend = {
    name: "localStorage",
    getItem: async (key: string) => {
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
    setItem: async (key: string, value: string) => {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, value);
      } else {
        memoryStorage.set(key, value);
      }
    },
    get size(): number {
      if (typeof window !== "undefined" && window.localStorage) {
        let total = 0;
        for (let key in localStorage) {
          if (!localStorage.hasOwnProperty(key)) {
            continue;
          }
          total += (localStorage[key].length + key.length) * 2;
        }
        return total;
      }
      return 0;
    },
    clear: () => {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.clear();
      } else {
        memoryStorage.clear();
      }
    },
  };

  export function getDefault(): StorageBackend {
    if (typeof window === "undefined" || !window.localStorage) {
    }
    return StorageBackends.webLocal;
  }
}

export default StorageBackends;
