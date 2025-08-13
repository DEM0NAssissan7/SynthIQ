import { getLastRescueMinutes, getLastRescueCaps } from "../lib/healthMonitor";
import { round } from "../lib/util";
import { HealthMonitorStore } from "../storage/healthMonitorStore";

export default function GlucoseSuggestion({
  intelligentCorrection,
  baseCorrection,
}: {
  intelligentCorrection: number;
  baseCorrection: number;
}) {
  const [timeBetweenShots] = HealthMonitorStore.timeBetweenShots.useState();
  const lastRescueMinutes = round(getLastRescueMinutes(), 0);
  const lastRescueCaps = getLastRescueCaps();
  if (lastRescueMinutes < timeBetweenShots && lastRescueCaps > 0) {
    return (
      <>
        It's been <b>{lastRescueMinutes}</b> minutes since your last glucose
        shot. Consider waiting <b>{timeBetweenShots - lastRescueMinutes}</b>{" "}
        minutes before taking more glucose
      </>
    );
  } else {
    return (
      <>
        Take <b>{round(intelligentCorrection, 1)} caps/grams</b> of glucose (
        {round(baseCorrection, 0)} minimum).
      </>
    );
  }
}
