import StorageNode from "./storageNode";

export namespace HealthMonitorStore {
  const node = new StorageNode("healthMonitor");

  export const timeBetweenShots = node.add("timeBetweenShots", 15);
  export const dropTime = node.add("dropTime", 20);
  export const basalShotsPerDay = node.add("basalShotsPerDay", 1);
  export const basalShotTime = node.add("basalShotTime", 8);
  export const insulinMinFraction = 0.3;
  export const maxHoursBetweenSessions = node.add("maxHoursBetweenSessions", 3);
}
