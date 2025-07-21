import StorageNode from "../lib/storageNode";

const privateStore = new StorageNode("private", true);
privateStore.add("apiSecret", "");
privateStore.add("syncUUID", 0);
privateStore.add("isMaster", null);

export default privateStore;
