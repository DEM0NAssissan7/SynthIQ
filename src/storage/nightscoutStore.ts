import StorageNode from "../lib/storageNode";
import RequestQueue from "../models/requestQueue";

export const nightscoutStore = new StorageNode("nightscout");
nightscoutStore.add("url", null);
nightscoutStore.add("apiSecret", "");
nightscoutStore.add("profileID", 0);
nightscoutStore.add("skipSetup", false);

// CGM
nightscoutStore.add("minutesPerReading", 5);
nightscoutStore.add("cgmDelay", 5);

// Meals
nightscoutStore.add("ignoredUUIDs", []);

// Queue
nightscoutStore.add(
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
