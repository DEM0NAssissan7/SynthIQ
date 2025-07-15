import StorageNode from "../lib/storageNode";
import HealthMonitorStatus, {
  getStatusFromName,
  getStatusName,
} from "../models/types/healthMonitorStatus";
import type { SugarReading } from "../models/types/sugarReading";

const healthMonitorStore = new StorageNode("healthmonitor");
export default healthMonitorStore;

healthMonitorStore.add("readingsCache", [] as SugarReading[]);
healthMonitorStore.add("readingsCacheSize", 5);

healthMonitorStore.add(
  "status",
  HealthMonitorStatus.Nominal,
  getStatusFromName,
  getStatusName
);
