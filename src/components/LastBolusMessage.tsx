import { getFormattedTime, getMinuteDiff } from "../lib/timing";
import { round } from "../lib/util";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { useNow } from "../state/useNow";
function formatDose(value: number) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export default function LastBolusMessage() {
  const [boluses] = HealthMonitorStore.recentBoluses.useState();
  const now = useNow(60);

  const activeBoluses = [...boluses]
    .filter((insulin) => insulin.isActive)
    .sort((a, b) => b.iob(now) - a.iob(now));

  if (activeBoluses.length === 0) {
    return (
      <div className="text-muted small py-1">
        No active insulin currently on board.
      </div>
    );
  }

  const latestBolus = activeBoluses[0];
  const totalIOB = activeBoluses.reduce(
    (sum, insulin) => sum + insulin.iob(now),
    0,
  );
  const totalAbsorptionRate = activeBoluses.reduce(
    (sum, insulin) => sum + insulin.absorptionRate(now),
    0,
  );

  return (
    <div className="d-flex flex-column gap-2">
      <div className="app-stat-strip">
        <div className="app-stat-strip-item">
          <span className="stat-label">On Board</span>
          <span className="stat-value">{formatDose(totalIOB)}u</span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Activity Rate</span>
          <span className="stat-value">{formatDose(totalAbsorptionRate)} u/hr</span>
        </div>
        <div className="app-stat-strip-item" style={{ gridColumn: "span 2" }}>
          <span className="stat-label">Last Dose</span>
          <span className="stat-value">
            {formatDose(latestBolus.value)}u · {getFormattedTime(getMinuteDiff(now, latestBolus.timestamp))} ago
          </span>
        </div>
      </div>

      <div className="d-flex flex-column gap-1">
        {activeBoluses.map((insulin, index) => {
          const iob = insulin.iob(now);
          return (
            <div
              key={`${insulin.timestamp.getTime()}-${insulin.variant.name}-${index}`}
              className="app-dose-item"
            >
              <span className="dose-name">
                <i className="bi bi-capsule-pill text-primary opacity-75" style={{ fontSize: "0.75rem" }} />
                <span>
                  {formatDose(insulin.value)}u {insulin.variant.name} ·{" "}
                  {getFormattedTime(getMinuteDiff(now, insulin.timestamp))} ago
                </span>
              </span>
              <span className="dose-value fw-semibold" style={{ fontSize: "0.82rem" }}>
                {formatDose(iob)}u IOB
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
