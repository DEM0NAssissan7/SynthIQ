import {
  KeyDoesNotExistError,
  StorageBackendFailedError,
} from "../models/types/errors";
import type { StorageBackend } from "../models/types/interfaces/storageBackend";

namespace StorageBackends {
  export const webLocal: StorageBackend = {
    name: "localStorage",
    getItem: async (key: string) => {
      if (typeof window !== "undefined" && window.localStorage) {
        const retval = localStorage.getItem(key);
        if (retval === null) throw new KeyDoesNotExistError();
        return retval;
      } else {
        throw new StorageBackendFailedError();
      }
    },
    setItem: async (key: string, value: string) => {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, value);
      } else {
        throw new StorageBackendFailedError();
      }
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
