import { getLastRescueMinutes, getLastRescueCaps } from "../lib/healthMonitor";
import { round } from "../lib/util";
import { HealthMonitorStore } from "../storage/healthMonitorStore";

export default function GlucoseSuggestion({
  intelligentCorrection,
  baseCorrection,
  unitName,
}: {
  intelligentCorrection: number;
  baseCorrection: number;
  unitName: string;
}) {
  const [timeBetweenShots] = HealthMonitorStore.timeBetweenShots.useState();
  const lastRescueMinutes = round(getLastRescueMinutes(), 0);
  const lastRescueCaps = getLastRescueCaps();
  const displayRange =
    baseCorrection === intelligentCorrection
      ? `${baseCorrection}`
      : `${Math.min(baseCorrection, intelligentCorrection)} - ${Math.max(
          baseCorrection,
          intelligentCorrection
        )}`;
  return (
    <>
      {lastRescueMinutes < timeBetweenShots && lastRescueCaps > 0 && (
        <>
          It's been <b>{lastRescueMinutes}</b> minutes since your last dose.
          Consider waiting <b>{timeBetweenShots - lastRescueMinutes}</b> minutes
          before taking more.
          <hr />
        </>
      )}
      Take <b>{displayRange}</b> {unitName}
    </>
  );
}
