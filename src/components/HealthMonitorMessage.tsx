import {
  getBGVelocity,
  getCurrentBG,
  healthMonitorStatus,
  timeToCritical,
} from "../lib/healthMonitor";
import { round } from "../lib/util";
import HealthMonitorStatus from "../models/types/healthMonitorStatus";
import { profile } from "../storage/metaProfileStore";
import preferencesStore from "../storage/preferencesStore";

export default function HealthMonitorMessage() {
  const fallRate = -getBGVelocity();
  const time = timeToCritical();
  const dangerBG = preferencesStore.get("dangerBG");

  const currentBG = getCurrentBG();
  const targetBG = profile.target;
  const highBG = preferencesStore.get("highBG");

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
          Your blood sugar was <b>{currentBG} mg/dL</b>, {targetBG - currentBG}{" "}
          mg/dL below the target. Your blood sugar is falling at a rate of{" "}
          <b>{round(fallRate, 0)} pts/hr</b>.
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
