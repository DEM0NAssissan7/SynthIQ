import { getFormattedTime, getMinuteDiff } from "../lib/timing";
import { round } from "../lib/util";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { useNow } from "../state/useNow";
import MdIcon from "./md3/MdIcon";
import { totalActivity, totalIOB } from "./hub/hubEvents";
function formatDose(value: number) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

/**
 * Insulin on board and its breakdown. Totals use the same functions as the
 * hub's IOB chip and strip (every bolus given before `nowMs`, including the
 * small remainder of doses past their duration), so the numbers always match.
 */
export default function LastBolusMessage({ nowMs }: { nowMs?: number }) {
  const [boluses] = HealthMonitorStore.recentBoluses.useState();
  const fallbackNow = useNow(5);
  const now = new Date(nowMs ?? fallbackNow.getTime());
  const t = now.getTime();

  const given = boluses.filter((b) => b.timestamp.getTime() <= t);
  const totalIOBNow = totalIOB(boluses, t);
  const totalAbsorptionRate = totalActivity(boluses, t);
  const activeBoluses = given
    .filter((insulin) => insulin.getActivityStatus(now))
    .sort((a, b) => b.iob(now) - a.iob(now));
  // What doses past their duration still contribute (by the model, ~6% each).
  const olderRemainder =
    totalIOBNow - activeBoluses.reduce((sum, b) => sum + b.iob(now), 0);

  if (activeBoluses.length === 0 && totalIOBNow < 0.05) {
    return (
      <div className="text-muted small py-1">
        No active insulin currently on board.
      </div>
    );
  }

  const latestBolus = [...given].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  )[0];

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
              style={{
                fontSize: "2.1rem",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {formatDose(totalIOBNow)}
            </span>
            <span
              className="text-body-secondary fw-semibold"
              style={{ fontSize: "1.15rem" }}
            >
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
          <div
            className="fw-bold text-body mt-0.5"
            style={{ fontSize: "1.2rem", lineHeight: 1.2 }}
          >
            {formatDose(totalAbsorptionRate)}{" "}
            <span
              className="text-muted fw-normal"
              style={{ fontSize: "0.88rem" }}
            >
              u/hr
            </span>
          </div>
          {latestBolus && (
            <div
              className="text-muted small mt-1"
              style={{ fontSize: "0.82rem" }}
            >
              Last: {formatDose(latestBolus.value)}u ·{" "}
              {getFormattedTime(getMinuteDiff(now, latestBolus.timestamp))} ago
            </div>
          )}
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
                <MdIcon name="syringe" className="text-primary" size={18} />
                <span>
                  {formatDose(insulin.value)}u {insulin.variant.name}
                  <span className="dose-sub ms-1">
                    · {getFormattedTime(getMinuteDiff(now, insulin.timestamp))}{" "}
                    ago
                  </span>
                </span>
              </span>
              <span className="dose-value">
                {formatDose(iob)}u{" "}
                <span
                  className="text-muted fw-normal"
                  style={{ fontSize: "0.82rem" }}
                >
                  IOB
                </span>
              </span>
            </div>
          );
        })}
        {olderRemainder >= 0.05 && (
          <div className="app-dose-item">
            <span className="dose-name">
              <MdIcon name="history" className="text-muted" size={18} />
              <span>
                Older doses
                <span className="dose-sub ms-1">· past their duration</span>
              </span>
            </span>
            <span className="dose-value">
              {formatDose(olderRemainder)}u{" "}
              <span
                className="text-muted fw-normal"
                style={{ fontSize: "0.82rem" }}
              >
                IOB
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
