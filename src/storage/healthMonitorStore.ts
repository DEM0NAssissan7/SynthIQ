import StorageNode from "../lib/storageNode";
import Glucose from "../models/events/glucose";
import {
  createNightscoutReading,
  getReadingFromNightscout,
  type SugarReading,
} from "../models/types/sugarReading";

const healthMonitorStore = new StorageNode("healthmonitor");
export default healthMonitorStore;

healthMonitorStore.add(
  "readingsCache",
  [] as SugarReading[],
  (s: string) => JSON.parse(s).map((a: any) => getReadingFromNightscout(a)),
  (r: SugarReading[]) =>
    JSON.stringify(r.map((a) => createNightscoutReading(a)))
);
healthMonitorStore.add("readingsCacheSize", 5);

healthMonitorStore.add(
  "lastRescue",
  new Glucose(new Date(), 0),
  (s: string) => Glucose.parse(s),
  (a: any) => Glucose.stringify(a)
);

healthMonitorStore.add("currentBG", 83);
healthMonitorStore.add("timeBetweenShots", 15);
healthMonitorStore.add("dropTime", 20);

healthMonitorStore.add("basalShotsPerDay", 1);
healthMonitorStore.add("basalShotTime", 8); // The hour time we take our first shot of the day. E.g. 8 => 8:00 AM, 16 => 4:00 PM
