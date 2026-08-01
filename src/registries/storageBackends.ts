import { KeyDoesNotExistError } from "../models/types/errors";
import type { StorageBackend } from "../models/types/interfaces/storageBackend";

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

const memoryStorage = new Map<string, string>();

function sendNativeStorageRequest(
  type: string,
  key?: string,
  value?: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.ReactNativeWebView) {
      return reject(new Error("ReactNativeWebView bridge is not available"));
    }

    const id =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    let timeoutId: any;

    const listener = (event: any) => {
      try {
        let data = event.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (data && data.type === "ASYNC_STORAGE_RESPONSE" && data.id === id) {
          clearTimeout(timeoutId);
          window.removeEventListener("message", listener);
          // @ts-ignore
          document.removeEventListener("message", listener);
          resolve(data.value);
        }
      } catch (e) {
        // ignore unparseable messages
      }
    };

    window.addEventListener("message", listener);
    // @ts-ignore
    document.addEventListener("message", listener);

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", listener);
      // @ts-ignore
      document.removeEventListener("message", listener);
      reject(new Error(`Native storage request timeout for key ${key}`));
    }, 3000);

    window.ReactNativeWebView.postMessage(
      JSON.stringify({ id, type, key, value }),
    );
  });
}

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

  export const asyncStorage: StorageBackend = {
    name: "asyncStorage",
    getItem: async (key: string) => {
      if (typeof window !== "undefined" && window.ReactNativeWebView) {
        try {
          const val = await sendNativeStorageRequest("ASYNC_STORAGE_GET", key);
          if (val === null || val === undefined) {
            // Check fallback webLocal if not found in native storage
            return await StorageBackends.webLocal.getItem(key);
          }
          return val;
        } catch (err) {
          console.warn(
            "AsyncStorage native bridge get failed, falling back to webLocal:",
            err,
          );
          return await StorageBackends.webLocal.getItem(key);
        }
      }
      return await StorageBackends.webLocal.getItem(key);
    },
    setItem: async (key: string, value: string) => {
      // Set in webLocal for redundancy
      await StorageBackends.webLocal.setItem(key, value);
      if (typeof window !== "undefined" && window.ReactNativeWebView) {
        try {
          await sendNativeStorageRequest("ASYNC_STORAGE_SET", key, value);
        } catch (err) {
          console.warn("AsyncStorage native bridge set failed:", err);
        }
      }
    },
    get size(): number {
      return StorageBackends.webLocal.size;
    },
    clear: () => {
      StorageBackends.webLocal.clear();
      if (typeof window !== "undefined" && window.ReactNativeWebView) {
        sendNativeStorageRequest("ASYNC_STORAGE_CLEAR").catch((err) =>
          console.warn("AsyncStorage native bridge clear failed:", err),
        );
      }
    },
  };

  export function getDefault(): StorageBackend {
    if (typeof window !== "undefined" && window.ReactNativeWebView) {
      return StorageBackends.asyncStorage;
    }
    return StorageBackends.webLocal;
  }
}

export default StorageBackends;
