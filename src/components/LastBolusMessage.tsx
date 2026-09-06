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
    <div className="d-flex flex-column gap-2.5">
      <div className="d-flex align-items-baseline justify-content-between px-1">
        <div>
          <div
            className="text-uppercase fw-bold text-muted"
            style={{ fontSize: "0.74rem", letterSpacing: "0.06em" }}
          >
            On Board (IOB)
          </div>
          <div className="d-flex align-items-baseline gap-1 mt-0.5">
            <span
              className="fw-bold text-body"
              style={{ fontSize: "2.1rem", lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              {formatDose(totalIOB)}
            </span>
            <span className="text-body-secondary fw-semibold" style={{ fontSize: "1.15rem" }}>
              u
            </span>
          </div>
        </div>
        <div className="text-end">
          <div
            className="text-uppercase fw-bold text-muted"
            style={{ fontSize: "0.74rem", letterSpacing: "0.06em" }}
          >
            Activity Rate
          </div>
          <div className="fw-bold text-body mt-0.5" style={{ fontSize: "1.2rem", lineHeight: 1.2 }}>
            {formatDose(totalAbsorptionRate)}{" "}
            <span className="text-muted fw-normal" style={{ fontSize: "0.88rem" }}>
              u/hr
            </span>
          </div>
          <div className="text-muted small mt-1" style={{ fontSize: "0.82rem" }}>
            Last: {formatDose(latestBolus.value)}u ·{" "}
            {getFormattedTime(getMinuteDiff(now, latestBolus.timestamp))} ago
          </div>
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
                <i
                  className="bi bi-capsule-pill text-primary opacity-75"
                  style={{ fontSize: "0.85rem" }}
                />
                <span>
                  {formatDose(insulin.value)}u {insulin.variant.name}
                  <span className="dose-sub ms-1">
                    · {getFormattedTime(getMinuteDiff(now, insulin.timestamp))} ago
                  </span>
                </span>
              </span>
              <span className="dose-value">
                {formatDose(iob)}u{" "}
                <span className="text-muted fw-normal" style={{ fontSize: "0.82rem" }}>
                  IOB
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
