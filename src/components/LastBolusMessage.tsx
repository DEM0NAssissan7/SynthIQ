import { getTimeSinceLastBolus } from "../lib/healthMonitor";
import { getFormattedTime } from "../lib/timing";
import { HealthMonitorStore } from "../storage/healthMonitorStore";

export default function LastBolusMessage() {
  const [lastBolus] = HealthMonitorStore.lastBolus.useState();

  return (
    <>
      Last bolus:
      <br />
      {lastBolus.value}u of <b>{lastBolus.variant.name}</b> taken{" "}
      {getFormattedTime(getTimeSinceLastBolus() * 60)} ago
    </>
  );
}
