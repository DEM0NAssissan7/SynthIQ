import {
  getBGVelocity,
  getCurrentBG,
  getHealthMonitorStatus,
  timeToCritical,
} from "../lib/healthMonitor";
import { round } from "../lib/util";
import HealthMonitorStatus from "../models/types/healthMonitorStatus";
import { PreferencesStore } from "../storage/preferencesStore";
import { useStream } from "../state/useStream";

export default function HealthMonitorMessage() {
  useStream(); // Re-render with the stream
  const fallRate = -getBGVelocity();
  const time = timeToCritical();
  const [dangerBG] = PreferencesStore.dangerBG.useState();

  const currentBG = getCurrentBG() ?? 0;
  const [highBG] = PreferencesStore.highBG.useState();

  const status = getHealthMonitorStatus();

  switch (status) {
    case HealthMonitorStatus.Nominal:
      return "";
    case HealthMonitorStatus.Falling:
      return (
        <>
          Your blood sugar is falling at a rate of{" "}
          <b>{round(fallRate / 60, 0)} pts/min</b>.
          {Number.isFinite(time) && time > 0 && (
            <>
              {" "}
              You will reach <b>{dangerBG} mg/dL</b> in <b>{time} minutes</b>.
            </>
          )}
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
