import {
  getBGVelocity,
  healthMonitorStatus,
  timeToCritical,
} from "../lib/healthMonitor";
import { round } from "../lib/util";
import HealthMonitorStatus from "../models/types/healthMonitorStatus";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PreferencesStore } from "../storage/preferencesStore";

export default function HealthMonitorMessage() {
  const fallRate = -getBGVelocity();
  const time = timeToCritical();
  const [dangerBG] = PreferencesStore.dangerBG.useState();

  const [currentBG] = HealthMonitorStore.currentBG.useState();
  const [targetBG] = PreferencesStore.targetBG.useState();
  const [highBG] = PreferencesStore.highBG.useState();

  switch (healthMonitorStatus) {
    case HealthMonitorStatus.Nominal:
      return "Health status is currently nominal";
    case HealthMonitorStatus.Falling:
      return (
        <>
          Your blood sugar is falling at a rate of{" "}
          <b>{round(fallRate, 0)} pts/hr</b>. You are predicted to reach{" "}
          {dangerBG} mg/dL within <b>{time} minutes</b>
        </>
      );
    case HealthMonitorStatus.Low:
      return (
        <>
          {" "}
          Your blood sugar is falling at a rate of{" "}
          <b>{round(fallRate, 0)} pts/hr</b>. Your blood sugar was{" "}
          <b>{currentBG} mg/dL</b>, {targetBG - currentBG} mg/dL below the
          target.
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
