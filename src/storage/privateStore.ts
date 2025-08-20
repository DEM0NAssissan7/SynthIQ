import StorageNode from "./storageNode";

export namespace PrivateStore {
  const node = new StorageNode("private", true);

  export const apiSecret = node.add("apiSecret", "");
  export const syncUUID = node.add("syncUUID", 0);
  export const isMaster = node.add<boolean | null>("isMaster", null);
}
