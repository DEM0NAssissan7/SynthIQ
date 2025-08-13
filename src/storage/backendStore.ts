import Serialization from "../lib/serialization";
import StorageNode from "./storageNode";
import RequestQueue from "../models/requestQueue";

export namespace BackendStore {
  const node = new StorageNode("nightscout");
  export const url = node.add<string | null>("url", null);
  export const queue = node.add<RequestQueue[]>(
    "queue",
    [],
    Serialization.getArraySerializer(RequestQueue.serialize),
    Serialization.getArrayDeserializer(RequestQueue.deserialize)
  );

  export const profileID = node.add<number>("profileID", 0);
  export const skipSetup = node.add<boolean>("skipSetup", false);

  // CGM
  export const minutesPerReading = node.add<number>("minutesPerReading", 5);
  export const cgmDelay = node.add<number>("cgmDelay", 5);

  // Meals
  export const ignoredUUIDs = node.add<number[]>("ignoredUUIDs", []);
}
