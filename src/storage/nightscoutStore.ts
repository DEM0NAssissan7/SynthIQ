import StorageNode from "../lib/storageNode";

export const nightscoutStorage = new StorageNode("nightscout");
nightscoutStorage.add("url", null);
nightscoutStorage.add("apiSecret", "");
nightscoutStorage.add("profileID", 0);

// CGM
nightscoutStorage.add("minutesPerReading", 5);
nightscoutStorage.add("cgmDelay", 5);

// Meals
nightscoutStorage.add("ignoredUUIDs", []);
