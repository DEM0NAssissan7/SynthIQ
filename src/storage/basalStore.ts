import StorageNode from "../lib/storageNode";

const basalStore = new StorageNode("basal");
export default basalStore;

basalStore.add("basalDoses", []);
basalStore.add(
  "lastBasalTimestamp",
  new Date(""),
  (a: string) => new Date(a),
  (d: Date) => d.toString()
);

basalStore.add("fastingVelocitiesCache", []);
basalStore.add("fastingVelocitiesCacheLastUpdated", new Date(""));

// Fasting state qualifiers
basalStore.add("minTimeSinceMeal", 5.5); // Hours
basalStore.add("minTimeSinceBolus", 7); // Hours
basalStore.add("minTimeSinceDextrose", 30); // Minutes

basalStore.add("basalEffect", 1.5); // Rate effect (mg/dL) per hour of 1 unit of basal insulin
basalStore.add("basalEffectDays", 3); // Days basal stays in system

// Changes logic
basalStore.add("lastRecommendation", []);
basalStore.add("shotsSinceLastChange", 0);
