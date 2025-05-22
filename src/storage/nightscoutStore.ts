import StorageNode from "../lib/storageNode";

export const nightscoutStore = new StorageNode("nightscout");
nightscoutStore.add("url", null);
nightscoutStore.add("apiSecret", "");
nightscoutStore.add("profileID", 0);

// CGM
nightscoutStore.add("minutesPerReading", 5);
nightscoutStore.add("cgmDelay", 5);

// Meals
nightscoutStore.add("ignoredUUIDs", []);
