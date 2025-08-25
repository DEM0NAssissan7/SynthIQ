import Serialization from "../lib/serialization";
import StorageNode from "./storageNode";
import Glucose from "../models/events/glucose";
import SugarReading from "../models/types/sugarReading";

export namespace HealthMonitorStore {
  const node = new StorageNode("healthMonitor");

  export const readingsCache = node.add<SugarReading[]>(
    "readingsCache",
    [],
    Serialization.getArraySerializer(SugarReading.serialize),
    Serialization.getArrayDeserializer(SugarReading.deserialize)
  );
  export const lastRescue = node.add<Glucose>(
    "lastRescue",
    new Glucose(0, new Date()),
    Glucose.serialize,
    Glucose.deserialize
  );
  export const readingsCacheSize = node.add("readingsCacheSize", 6);
  export const currentBG = node.add("currentBG", 83);
  export const timeBetweenShots = node.add("timeBetweenShots", 15);
  export const dropTime = node.add("dropTime", 20);
  export const basalShotsPerDay = node.add("basalShotsPerDay", 1);
  export const basalShotTime = node.add("basalShotTime", 8);
}
