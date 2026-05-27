import { getFormattedTime, getMinuteDiff, getPrettyTime } from "../lib/timing";
import { round } from "../lib/util";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { useNow } from "../state/useNow";
import { MetricGrid, MetricPill } from "./PageLayout";

function formatDose(value: number) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

interface LastBolusMessageProps {
  title?: string;
}

export default function LastBolusMessage({
  title = "Active Insulin",
}: LastBolusMessageProps) {
  const [boluses] = HealthMonitorStore.recentBoluses.useState();
  const now = useNow(60);

  const activeBoluses = [...boluses]
    .filter((insulin) => insulin.isActive)
    .sort((a, b) => b.iob(now) - a.iob(now));

  if (activeBoluses.length === 0) {
    return <div className="text-muted">No recent insulin doses</div>;
  }

  const latestBolus = activeBoluses[0];
  const totalIOB = activeBoluses.reduce(
    (sum, insulin) => sum + insulin.iob(now),
    0,
  );

  return (
    <div>
      <div className="d-flex align-items-start gap-3 mb-3">
        <div className="app-action-icon">
          <i className="bi bi-capsule-pill fs-4" />
        </div>
        <div>
          <div className="app-kicker mb-1">Insulin</div>
          <h2 className="h5 mb-1">{title}</h2>
        </div>
      </div>

      <MetricGrid>
        <MetricPill
          label="Last Taken At"
          value={getPrettyTime(latestBolus.timestamp)}
        />
        <MetricPill label="Total on board" value={`${formatDose(totalIOB)}u`} />
      </MetricGrid>

      <div className="d-grid gap-2 mt-3">
        {activeBoluses.map((insulin, index) => {
          const iob = insulin.iob(now);
          return (
            <div
              key={`${insulin.timestamp.getTime()}-${insulin.variant.name}-${index}`}
              className="rounded-4 border p-3 bg-light-subtle"
            >
              <div className="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <div className="fw-semibold">
                    {formatDose(insulin.value)}u {insulin.variant.name}
                  </div>
                  <div className="small text-muted">
                    Taken{" "}
                    {getFormattedTime(getMinuteDiff(now, insulin.timestamp))}{" "}
                    ago
                  </div>
                </div>
                <div className="text-end">
                  <div className="small text-muted">On board</div>
                  <div className="fw-semibold">{formatDose(iob)}u</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
