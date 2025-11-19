import SugarReading from "../models/types/sugarReading";
import StorageNode from "./storageNode";

export namespace CacheStore {
  const node = new StorageNode("cache");

  export const lastBG = node.add(
    "lastBG",
    new SugarReading(100, new Date()),
    SugarReading.serialize,
    SugarReading.deserialize
  );
}
