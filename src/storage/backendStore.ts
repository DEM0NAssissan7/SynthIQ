import StorageNode from "../lib/storageNode";
import RequestQueue from "../models/requestQueue";

export const backendStore = new StorageNode("nightscout");
backendStore.add("url", null);
backendStore.add("apiSecret", "");
backendStore.add("profileID", 0);
backendStore.add("skipSetup", false);

// CGM
backendStore.add("minutesPerReading", 5);
backendStore.add("cgmDelay", 5);

// Meals
backendStore.add("ignoredUUIDs", []);

// Queue
backendStore.add(
  "queue",
  [],
  (s: string) => {
    const stringArray = JSON.parse(s);
    return stringArray.map((a: any) => RequestQueue.parse(a));
  },
  (requests: RequestQueue[]) => {
    const stringArray = requests.map((a: RequestQueue) =>
      RequestQueue.stringify(a)
    );
    return JSON.stringify(stringArray);
  }
);

backendStore.add("syncUUID", 0);
backendStore.add("isMaster", null);
