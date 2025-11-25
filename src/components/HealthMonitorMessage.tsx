import { getBGVelocity, timeToCritical } from "../lib/healthMonitor";
import { round } from "../lib/util";
import HealthMonitorStatus from "../models/types/healthMonitorStatus";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PreferencesStore } from "../storage/preferencesStore";

export default function HealthMonitorMessage() {
  const fallRate = -getBGVelocity();
  const time = timeToCritical();
  const [dangerBG] = PreferencesStore.dangerBG.useState();

  const [currentBG] = HealthMonitorStore.currentBG.useState();
  const [highBG] = PreferencesStore.highBG.useState();

  const [status] = HealthMonitorStore.statusCache.useState();

  switch (status) {
    case HealthMonitorStatus.Nominal:
      return "Health status is currently nominal";
    case HealthMonitorStatus.Falling:
      return (
        <>
          Your blood sugar is falling at a rate of{" "}
          <b>{round(fallRate / 60, 0)} pts/min</b>. You will reach{" "}
          <b>{dangerBG} mg/dL</b> in <b>{time} minutes</b>.
        </>
      );
    case HealthMonitorStatus.Low:
      return (
        <>
          {" "}
          Your blood sugar is falling at a rate of{" "}
          <b>{round(fallRate / 60, 0)} pts/min</b>.
        </>
      );
    case HealthMonitorStatus.High:
      return (
        <>
          Your blood sugar was <b>{currentBG} mg/dL</b>, {currentBG - highBG}{" "}
          mg/dL higher than the threshold.
        </>
      );
  }
}
