import Serialization from "../lib/serialization";
import StorageNode from "./storageNode";
import Glucose from "../models/events/glucose";
import SugarReading from "../models/types/sugarReading";
import HealthMonitorStatus, {
  getStatusFromName,
  getStatusName,
} from "../models/types/healthMonitorStatus";
import Insulin from "../models/events/insulin";

export namespace HealthMonitorStore {
  const node = new StorageNode("healthMonitor");

  export const readingsCache = node.add<SugarReading[]>(
    "readingsCache",
    [],
    Serialization.getArraySerializer(SugarReading.serialize),
    Serialization.getArrayDeserializer(SugarReading.deserialize),
  );
  export const lastRescues = node.add<Glucose[]>(
    "lastRescues",
    [],
    Serialization.getArraySerializer(Glucose.serialize),
    Serialization.getArrayDeserializer(Glucose.deserialize),
  );
  export const numLastRescues = 16;
  export const recentBoluses = node.add<Insulin[]>(
    "recentBoluses",
    [],
    Serialization.getArraySerializer(Insulin.serialize),
    Serialization.getArrayDeserializer(Insulin.deserialize),
  );
  export const numRecentBoluses = 16;
  export const statusCache = node.add<HealthMonitorStatus>(
    "monitorStatusCache",
    HealthMonitorStatus.Nominal,
    (a) => getStatusName(a),
    (s) => getStatusFromName(s),
  );
  export const readingsCacheSize = 12;
  export const currentBG = node.add("currentBG", 83);
  export const timeBetweenShots = node.add("timeBetweenShots", 15);
  export const dropTime = node.add("dropTime", 20);
  export const basalShotsPerDay = node.add("basalShotsPerDay", 1);
  export const basalShotTime = node.add("basalShotTime", 8);
}
