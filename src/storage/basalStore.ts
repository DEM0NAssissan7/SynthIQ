import Serialization from "../lib/serialization";
import StorageNode from "./storageNode";
import Insulin from "../models/events/insulin";

export namespace BasalStore {
  const node = new StorageNode("basal");

  export const basalDoses = node.add<Insulin[]>(
    "doses",
    [],
    Serialization.getArraySerializer(Insulin.serialize),
    Serialization.getArrayDeserializer(Insulin.deserialize)
  );
  export const fastingVelocitiesCache = node.add<number[]>(
    "fastingVelocitiesCache",
    []
  );
  export const fastingVelocitiesCacheLastUpdated = node.add<Date>(
    "fastingVelocitiesCacheLastUpdated",
    new Date("")
  );
  export const minTimeSinceMeal = node.add<number>("minTimeSinceMeal", 6);
  export const minTimeSinceDextrose = node.add<number>(
    "minTimeSinceDextrose",
    20
  );
  export const basalEffect = node.add<number>("basalEffect", 1.5);
  export const basalEffectDays = node.add<number>("basalEffectDays", 3);
  export const lastRecommendation = node.add<any[]>("lastRecommendation", []);
  export const shotsSinceLastChange = node.add<number>(
    "shotsSinceLastChange",
    0
  );
}
