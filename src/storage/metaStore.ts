import StorageNode from "./storageNode";

export namespace MetaStore {
  const node = new StorageNode("meta");

  export const version = node.add("version", 1);
}
