import { useEffect, useMemo, useState } from "react";
import Card from "./Card";
import MdIcon from "./md3/MdIcon";
import RollingCounter from "./RollingCounter";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { useNow } from "../state/useNow";
import { getPredictedGlucose } from "../lib/helpers/getPredictedGlucose";
import { getFormattedTime, getHourDiff, getMinuteDiff } from "../lib/timing";
import { getBGVelocity, populateReadingCache } from "../lib/healthMonitor";
import { round } from "../lib/util";

export default function PredictedGlucoseCard() {
  const now = useNow(5);
  const [readings] = HealthMonitorStore.readingsCache.useState();
  const [targetBG] = PreferencesStore.targetBG.useState();
  const [lowBG] = PreferencesStore.lowBG.useState();
  const [highBG] = PreferencesStore.highBG.useState();
  const [decimalPredictedBG] = PreferencesStore.decimalPredictedBG.useState();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    populateReadingCache();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await populateReadingCache();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const anchor = useMemo(() => {
    return readings
      .slice()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }, [readings]);

  const predictedBG = useMemo(() => {
    return getPredictedGlucose(readings, now);
  }, [now, readings]);

  const delta = useMemo(() => {
    if (!anchor || predictedBG === null || !Number.isFinite(predictedBG))
      return 0;
    return predictedBG - anchor.sugar;
  }, [predictedBG, anchor]);

  const velocity = useMemo(() => {
    return getBGVelocity(readings);
  }, [readings]);

  const minutesAgo = useMemo(() => {
    if (!anchor) return 0;
    return Math.max(0, getMinuteDiff(now, anchor.timestamp));
  }, [now, anchor]);

  const velocityImpact = useMemo(() => {
    if (!anchor || !Number.isFinite(velocity)) return 0;
    const impact = velocity * getHourDiff(now, anchor.timestamp);
    return Number.isFinite(impact) ? impact : 0;
  }, [now, anchor, velocity]);

  const glucoseStatus = useMemo(() => {
    if (
      predictedBG === null ||
      !Number.isFinite(predictedBG) ||
      predictedBG <= 0
    )
      return null;
    const target = targetBG || 110;
    if (predictedBG < lowBG) {
      return {
        label: "Low",
        color: "var(--app-status-low)",
        bg: "rgba(186, 26, 26, 0.12)",
      };
    }
    if (predictedBG > highBG) {
      return {
        label: "Elevated",
        color: "var(--app-status-elevated)",
        bg: "rgba(168, 103, 0, 0.12)",
      };
    }
    if (Math.abs(predictedBG - target) <= 10) {
      return {
        label: "On Target",
        color: "var(--app-status-target)",
        bg: "rgba(46, 125, 50, 0.12)",
      };
    }
    return {
      label: "In Range",
      color: "var(--app-status-target)",
      bg: "rgba(46, 125, 50, 0.12)",
    };
  }, [predictedBG, targetBG, lowBG, highBG]);

  const formattedDelta = useMemo(() => {
    if (!Number.isFinite(delta) || delta === 0) return null;
    const abs = Math.abs(delta);
    const numStr = decimalPredictedBG
      ? abs.toFixed(1)
      : Math.round(abs).toString();
    return delta > 0 ? `+${numStr}` : `-${numStr}`;
  }, [delta, decimalPredictedBG]);

  return (
    <Card>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="app-card-title mb-0">
          <MdIcon name="ecg_heart" fill className="text-primary" size={20} />
          <span>Predicted Blood Sugar</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          {glucoseStatus && (
            <span
              className="badge rounded-pill px-2 py-1 fw-semibold"
              style={{
                color: glucoseStatus.color,
                backgroundColor: glucoseStatus.bg,
                fontSize: "0.75rem",
              }}
            >
              {glucoseStatus.label}
            </span>
          )}
          <button
            type="button"
            className="btn btn-link p-0 text-muted d-inline-flex align-items-center text-decoration-none border-0"
            style={{ opacity: 0.7 }}
            onClick={handleRefresh}
            title="Refresh CGM data"
            disabled={isRefreshing}
          >
            <MdIcon
              name="sync"
              size={16}
              className={isRefreshing ? "spin-animation" : ""}
            />
          </button>
        </div>
      </div>

      {anchor && predictedBG !== null ? (
        <div className="d-flex flex-column gap-2.5">
          <div className="d-flex align-items-baseline justify-content-between px-1">
            <div>
              <div
                className="text-uppercase fw-bold text-muted"
                style={{ fontSize: "0.74rem", letterSpacing: "0.06em" }}
              >
                Now (Estimated)
              </div>
              <div className="d-flex align-items-baseline gap-1 mt-0.5">
                <RollingCounter
                  value={predictedBG}
                  decimals={decimalPredictedBG ? 1 : 0}
                  className="fw-bold text-body"
                  style={{
                    fontSize: "2.1rem",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                />
                <span
                  className="text-body-secondary fw-semibold"
                  style={{ fontSize: "1.15rem" }}
                >
                  mg/dL
                </span>
                {formattedDelta !== null && (
                  <span
                    className="small fw-semibold ms-1"
                    style={{
                      fontSize: "0.82rem",
                      color:
                        delta > 0
                          ? "var(--app-status-elevated)"
                          : "var(--app-status-target)",
                    }}
                  >
                    ({formattedDelta})
                  </span>
                )}
              </div>
            </div>

            <div className="text-end">
              <div
                className="text-uppercase fw-bold text-muted"
                style={{ fontSize: "0.74rem", letterSpacing: "0.06em" }}
              >
                Latest CGM
              </div>
              <div
                className="fw-bold text-body mt-0.5"
                style={{ fontSize: "1.2rem", lineHeight: 1.2 }}
              >
                {anchor.sugar}{" "}
                <span
                  className="text-muted fw-normal"
                  style={{ fontSize: "0.88rem" }}
                >
                  mg/dL
                </span>
              </div>
              <div
                className="text-muted small mt-1"
                style={{ fontSize: "0.82rem" }}
              >
                {getFormattedTime(minutesAgo)} ago
                {Math.abs(velocity) >= 1 && (
                  <span>
                    {" "}
                    · {velocity > 0 ? "+" : ""}
                    {Math.round(velocity)}/hr
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expandable Calculation Breakdown */}
          <div className="d-flex justify-content-between align-items-center pt-1 border-top border-secondary-subtle">
            <button
              type="button"
              className="btn btn-link p-0 text-muted d-inline-flex align-items-center gap-1 text-decoration-none border-0"
              style={{ fontSize: "0.78rem" }}
              onClick={() => setShowDetails((prev) => !prev)}
            >
              <span>
                {showDetails ? "Hide calculation" : "View calculation"}
              </span>
              <MdIcon
                name={showDetails ? "expand_less" : "expand_more"}
                size={16}
              />
            </button>
            <span className="text-muted small" style={{ fontSize: "0.75rem" }}>
              {Number.isFinite(delta)
                ? `Net Δ ${delta > 0 ? `+${round(delta, 1)}` : round(delta, 1)} mg/dL`
                : ""}
            </span>
          </div>

          {showDetails && (
            <div className="d-flex flex-column gap-1.5 pt-0.5">
              <div className="app-dose-item">
                <span className="dose-name">
                  <MdIcon
                    name="trending_up"
                    className="text-secondary"
                    size={16}
                  />
                  <span>CGM Velocity</span>
                  <span className="dose-sub">
                    ({velocity > 0 ? "+" : ""}
                    {round(velocity, 1)} mg/dL/hr over {Math.round(minutesAgo)}
                    m)
                  </span>
                </span>
                <span className="dose-value">
                  {velocityImpact > 0 ? "+" : ""}
                  {round(velocityImpact, 1)} mg/dL
                </span>
              </div>

              <div className="app-dose-item">
                <span className="dose-name">
                  <MdIcon name="bolt" className="text-primary" size={16} />
                  <span>Predicted Shift</span>
                  <span className="dose-sub">(from {anchor.sugar} mg/dL)</span>
                </span>
                <span className="dose-value">
                  {Number.isFinite(delta)
                    ? `${delta > 0 ? "+" : ""}${round(delta, 1)} mg/dL`
                    : "--"}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-muted small py-1">
          No recent glucose readings available to generate a prediction.
        </div>
      )}
    </Card>
  );
}
