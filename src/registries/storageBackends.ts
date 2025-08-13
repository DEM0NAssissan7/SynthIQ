import {
  KeyDoesNotExistError,
  StorageBackendFailedError,
} from "../models/types/errors";
import type { StorageBackend } from "../models/types/interfaces";

namespace StorageBackends {
  export const webLocal: StorageBackend = {
    name: "localStorage",
    getItem: (key: string) => {
      if (typeof window !== "undefined" && window.localStorage) {
        const retval = webLocal.getItem(key);
        if (retval === null) throw new KeyDoesNotExistError();
        return retval;
      } else {
        throw new StorageBackendFailedError();
      }
    },
    setItem: (key: string, value: string) => {
      if (typeof window !== "undefined" && window.localStorage) {
        webLocal.setItem(key, value);
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
