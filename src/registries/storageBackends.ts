import {
  KeyDoesNotExistError,
  StorageBackendFailedError,
} from "../models/types/errors";
import type { StorageBackend } from "../models/types/interfaces/storageBackend";

namespace StorageBackends {
  export const webLocal: StorageBackend = {
    name: "localStorage",
    getItem: (key: string) => {
      if (typeof window !== "undefined" && window.localStorage) {
        const retval = localStorage.getItem(key);
        if (retval === null) throw new KeyDoesNotExistError();
        return retval;
      } else {
        throw new StorageBackendFailedError();
      }
    },
    setItem: (key: string, value: string) => {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, value);
      } else {
        throw new StorageBackendFailedError();
      }
    },
    get size(): number {
      let total = 0;
      for (let key in localStorage) {
        if (!localStorage.hasOwnProperty(key)) {
          continue;
        }
        total += (localStorage[key].length + key.length) * 2;
      }
      return total;
    },
    clear: () => {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.clear();
      } else {
        throw new StorageBackendFailedError();
      }
    },
  };

  export function getDefault(): StorageBackend {
    return StorageBackends.webLocal;
  }
}
export default StorageBackends;
