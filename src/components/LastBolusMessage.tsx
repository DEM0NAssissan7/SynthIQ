import { getTimeSinceLastBolus } from "../lib/healthMonitor";
import { getFormattedTime } from "../lib/timing";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { useNow } from "../state/useNow";

export default function LastBolusMessage() {
  const [boluses] = HealthMonitorStore.recentBoluses.useState();
  const now = useNow();

  return boluses.length > 0 ? (
    <>
      <h4>Recent boluses:</h4>
      {boluses.map((insulin) => {
        const iob = insulin.iob(now);
        return (
          <>
            <br />
            {insulin.value}u of <b>{insulin.variant.name}</b> taken{" "}
            {getFormattedTime(getTimeSinceLastBolus() * 60)} ago
            <br />
            <i>{iob !== 0 && `${iob.toFixed(1)}u on board`}</i>
            <br />
          </>
        );
      })}
    </>
  ) : (
    `No recent insulin doses`
  );
}
