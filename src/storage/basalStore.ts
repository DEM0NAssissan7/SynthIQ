import StorageNode from "./storageNode";

export namespace BasalStore {
  const node = new StorageNode("basal");

  export const minTimeSinceMeal = node.add<number>("minTimeSinceMeal", 6);
}
