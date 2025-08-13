import { useEffect, useState } from "react";
import type { KeyInterface } from "../storage/storageNode";

export function useStorageState<T>(key: KeyInterface<T>): [T, (v: T) => void] {
  const [value, setValue] = useState(key.value as T);

  useEffect(() => {
    const callback = (newVal: T) => setValue(newVal);
    key.subscribe(callback);
    return () => key.unsubscribe(callback);
  }, [key]);

  const updateValue = (v: T) => {
    key.value = v;
  };

  return [value as T, updateValue];
}
