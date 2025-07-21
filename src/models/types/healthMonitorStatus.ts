enum HealthMonitorStatus {
  Nominal,
  Low,
  Falling,
  High,
}
export default HealthMonitorStatus;

type StatusNameKey = [HealthMonitorStatus, string];
const statusNames: StatusNameKey[] = [
  [HealthMonitorStatus.Nominal, "nominal"],
  [HealthMonitorStatus.Low, "low"],
  [HealthMonitorStatus.Falling, "falling"],
  [HealthMonitorStatus.High, "high"],
];

// Serialization
export function getStatusName(status: HealthMonitorStatus): string {
  for (let a of statusNames) if (a[0] === status) return a[1];
  throw new Error(`Cannot find name for state ${status}`);
}
export function getStatusFromName(name: string): HealthMonitorStatus {
  for (let a of statusNames) if (a[1] === name) return a[0];
  throw new Error(`Cannot find state for name ${name}`);
}
