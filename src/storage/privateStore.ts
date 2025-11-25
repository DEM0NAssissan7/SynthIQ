import { MasterState } from "../models/types/masterState";
import StorageNode from "./storageNode";

export namespace PrivateStore {
  const node = new StorageNode("private", true);

  export const apiSecret = node.add("apiSecret", "");
  export const syncUUID = node.add("syncUUID", 0);
  export const masterState = node.add<MasterState>(
    "masterState",
    MasterState.NONE,
    MasterState.serialize,
    MasterState.deserialize
  );
  export const debugLogs = node.add("debugLogs", false);
}
