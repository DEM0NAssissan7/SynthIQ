import { useMemo } from "react";
import { getTimeSinceLastBolus } from "../lib/healthMonitor";
import { getFormattedTime } from "../lib/timing";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { useNow } from "../state/useNow";

export default function LastBolusMessage() {
  const [lastBolus] = HealthMonitorStore.lastBolus.useState();
  const now = useNow();
  const iob = useMemo(() => lastBolus.iob(now), [now]);

  return (
    <>
      Last bolus:
      <br />
      {lastBolus.value}u of <b>{lastBolus.variant.name}</b> taken{" "}
      {getFormattedTime(getTimeSinceLastBolus() * 60)} ago
      <br />
      <i>{iob !== 0 && `${iob.toFixed(1)}u on board`}</i>
    </>
  );
}
