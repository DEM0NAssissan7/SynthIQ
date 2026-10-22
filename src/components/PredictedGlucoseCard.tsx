import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Card from "./Card";
import MdIcon from "./md3/MdIcon";
import RollingCounter from "./RollingCounter";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { BackendStore } from "../storage/backendStore";
import { useNow } from "../state/useNow";
import { getPredictedGlucose } from "../lib/helpers/getPredictedGlucose";
import { getFormattedTime, getMinuteDiff } from "../lib/timing";
import { getBGVelocity, populateReadingCache } from "../lib/healthMonitor";
import { round } from "../lib/util";
import type SugarReading from "../models/types/sugarReading";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

interface GlucoseChartPoint {
  time: number;
  actual: number | null;
  predicted: number | null;
  isCalibration?: boolean;
  isAnchor?: boolean;
  isNow?: boolean;
  isFuture?: boolean;
}

interface GlucoseTooltipProps {
  active?: boolean;
  payload?: any[];
  anchor: SugarReading | null;
  now: Date;
  decimalPredictedBG: boolean;
}

function GlucoseTooltip({
  active,
  payload,
  anchor,
  now,
  decimalPredictedBG,
}: GlucoseTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const point: GlucoseChartPoint = payload[0]?.payload;
  if (!point) return null;

  const date = new Date(point.time);
  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const val = point.predicted ?? point.actual;
  const delta =
    anchor && val !== null && Number.isFinite(val) ? val - anchor.sugar : null;

  const diffMin = Math.round((point.time - now.getTime()) / 60000);
  let relTime = "Now";
  if (diffMin > 0) relTime = `in ${diffMin}m`;
  else if (diffMin < 0) relTime = `${Math.abs(diffMin)}m ago`;

  let typeLabel = "CGM Reading";
  let badgeColor = "var(--md-sys-color-secondary)";
  let badgeBg = "rgba(100, 100, 100, 0.12)";

  if (point.isCalibration) {
    typeLabel = "Calibration";
    badgeColor = "#e65100";
    badgeBg = "rgba(230, 81, 0, 0.12)";
  } else if (point.isAnchor) {
    typeLabel = "Latest CGM";
    badgeColor = "var(--app-primary)";
    badgeBg = "var(--app-primary-container)";
  } else if (point.isNow) {
    typeLabel = "Estimated Now";
    badgeColor = "var(--app-primary)";
    badgeBg = "var(--app-primary-container)";
  } else if (point.isFuture) {
    typeLabel = "Predicted";
    badgeColor = "var(--app-primary)";
    badgeBg = "var(--app-primary-container)";
  }

  const valStr =
    val !== null && Number.isFinite(val)
      ? decimalPredictedBG
        ? round(val, 1).toFixed(1)
        : Math.round(val).toString()
      : "--";

  const deltaStr = (() => {
    if (delta === null || !Number.isFinite(delta)) return null;
    const abs = Math.abs(delta);
    const numStr = decimalPredictedBG
      ? abs.toFixed(1)
      : Math.round(abs).toString();
    return delta > 0 ? `+${numStr}` : delta < 0 ? `-${numStr}` : numStr;
  })();

  return (
    <div
      className="p-2 rounded-3 shadow-sm border"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "var(--app-border)",
        color: "var(--app-text)",
        minWidth: 140,
        pointerEvents: "none",
      }}
    >
      <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
        <span className="small fw-semibold">{timeStr}</span>
        <span className="text-muted" style={{ fontSize: "0.72rem" }}>
          {relTime}
        </span>
      </div>
      <div className="d-flex align-items-baseline gap-1">
        <span className="fw-bold fs-5">{valStr}</span>
        <span className="text-muted small" style={{ fontSize: "0.75rem" }}>
          mg/dL
        </span>
        {deltaStr !== null && (
          <span
            className="small ms-auto fw-semibold"
            style={{
              fontSize: "0.75rem",
              color:
                delta! > 0
                  ? "var(--app-status-elevated)"
                  : delta! < 0
                    ? "var(--app-status-target)"
                    : "var(--app-text-muted)",
            }}
          >
            {deltaStr}
          </span>
        )}
      </div>
      <div className="mt-1">
        <span
          className="badge rounded-pill px-2 py-0.5"
          style={{
            fontSize: "0.68rem",
            color: badgeColor,
            backgroundColor: badgeBg,
          }}
        >
          {typeLabel}
        </span>
      </div>
    </div>
  );
}

export default function PredictedGlucoseCard() {
  const now = useNow(5);
  const [readings] = HealthMonitorStore.readingsCache.useState();
  const [targetBG] = PreferencesStore.targetBG.useState();
  const [lowBG] = PreferencesStore.lowBG.useState();
  const [highBG] = PreferencesStore.highBG.useState();
  const [decimalPredictedBG] = PreferencesStore.decimalPredictedBG.useState();
  const [cgmDelayRaw] = BackendStore.cgmDelay.useState();
  const cgmDelay = cgmDelayRaw && cgmDelayRaw > 0 ? cgmDelayRaw : 5;

  const [recentBoluses] = HealthMonitorStore.recentBoluses.useState();
  const [recentRescues] = HealthMonitorStore.lastRescues.useState();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [isScrolledToPast, setIsScrolledToPast] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    return getPredictedGlucose(readings, now, recentBoluses, recentRescues);
  }, [now, readings, recentBoluses, recentRescues]);

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

  // Predictions at milestones
  const pred30 = useMemo(() => {
    return getPredictedGlucose(
      readings,
      new Date(now.getTime() + 30 * 60 * 1000),
      recentBoluses,
      recentRescues,
    );
  }, [readings, now, recentBoluses, recentRescues]);

  const pred60 = useMemo(() => {
    return getPredictedGlucose(
      readings,
      new Date(now.getTime() + 60 * 60 * 1000),
      recentBoluses,
      recentRescues,
    );
  }, [readings, now, recentBoluses, recentRescues]);

  const delta30 = useMemo(() => {
    if (!anchor || pred30 === null || !Number.isFinite(pred30)) return null;
    return pred30 - anchor.sugar;
  }, [pred30, anchor]);

  const delta60 = useMemo(() => {
    if (!anchor || pred60 === null || !Number.isFinite(pred60)) return null;
    return pred60 - anchor.sugar;
  }, [pred60, anchor]);

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

  // Generate chart data series
  const { graphData, minVal, maxVal, xTicks, yTicks } = useMemo(() => {
    if (!readings || readings.length === 0 || !anchor) {
      return {
        graphData: [],
        minVal: 70,
        maxVal: 180,
        xTicks: [],
        yTicks: [80, 120, 160],
      };
    }

    // Filter valid readings with positive sugar
    const validMap = new Map<number, SugarReading>();
    for (const r of readings) {
      if (r.sugar && Number.isFinite(r.sugar) && r.sugar > 0 && r.timestamp) {
        validMap.set(r.timestamp.getTime(), r);
      }
    }

    const sortedReadings = Array.from(validMap.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    if (sortedReadings.length === 0) {
      return {
        graphData: [],
        minVal: 70,
        maxVal: 180,
        xTicks: [],
        yTicks: [80, 120, 160],
      };
    }

    const latestReading = sortedReadings[sortedReadings.length - 1];
    const latestTime = latestReading.timestamp.getTime();
    const nowMs = now.getTime();

    const data: GlucoseChartPoint[] = [];

    const precision = decimalPredictedBG ? 1 : 0;

    // 1. Historical points up to latest reading
    for (let i = 0; i < sortedReadings.length - 1; i++) {
      const r = sortedReadings[i];
      data.push({
        time: r.timestamp.getTime(),
        actual: r.sugar,
        predicted: null,
        isCalibration: r.isCalibration,
      });
    }

    // 2. Anchor point (connects actual and predicted seamlessly)
    data.push({
      time: latestTime,
      actual: latestReading.sugar,
      predicted: decimalPredictedBG
        ? round(latestReading.sugar, 1)
        : Math.round(latestReading.sugar),
      isCalibration: latestReading.isCalibration,
      isAnchor: true,
    });

    // 3. Discrete future CGM prediction points for the next hour
    const delayMs = cgmDelay * 60 * 1000;
    const horizonMs = Math.max(nowMs, latestTime) + 60 * 60 * 1000;

    // Insert "Now" point if now is past the latest reading by >= 1 minute
    if (nowMs - latestTime >= 60 * 1000) {
      const predNow = getPredictedGlucose(
        readings,
        now,
        recentBoluses,
        recentRescues,
      );
      if (predNow !== null && Number.isFinite(predNow)) {
        data.push({
          time: nowMs,
          actual: null,
          predicted: round(predNow, precision),
          isNow: true,
        });
      }
    }

    // Insert discrete future CGM intervals spaced by cgmDelay
    let nextT = latestTime + delayMs;
    while (nextT <= horizonMs) {
      // Avoid duplicate point too close to nowMs
      if (Math.abs(nextT - nowMs) >= 45 * 1000) {
        const pred = getPredictedGlucose(
          readings,
          new Date(nextT),
          recentBoluses,
          recentRescues,
        );
        if (pred !== null && Number.isFinite(pred)) {
          data.push({
            time: nextT,
            actual: null,
            predicted: round(pred, precision),
            isFuture: true,
          });
        }
      }
      nextT += delayMs;
    }

    // Ensure sorted order
    data.sort((a, b) => a.time - b.time);

    // Calculate Y domain
    let min = 9999;
    let max = -9999;
    for (const d of data) {
      if (d.actual !== null && Number.isFinite(d.actual)) {
        if (d.actual < min) min = d.actual;
        if (d.actual > max) max = d.actual;
      }
      if (d.predicted !== null && Number.isFinite(d.predicted)) {
        if (d.predicted < min) min = d.predicted;
        if (d.predicted > max) max = d.predicted;
      }
    }

    const effectiveLow = lowBG || 70;
    const effectiveHigh = highBG || 180;
    const yMin = Math.max(
      40,
      Math.floor((Math.min(min, effectiveLow) - 15) / 10) * 10,
    );
    const yMax = Math.min(
      450,
      Math.ceil((Math.max(max, effectiveHigh) + 15) / 10) * 10,
    );

    // Y ticks aligned to step
    const step = yMax - yMin <= 120 ? 20 : yMax - yMin <= 240 ? 30 : 40;
    const firstTick = Math.ceil(yMin / step) * step;
    const yTicksList: number[] = [];
    for (let y = firstTick; y <= yMax; y += step) {
      yTicksList.push(y);
    }

    // X ticks aligned to half-hour clock marks
    const xTicksList: number[] = [];
    if (data.length > 0) {
      const minTime = data[0].time;
      const maxTime = data[data.length - 1].time;
      const intervalMs = 30 * 60 * 1000;
      let t = Math.ceil(minTime / intervalMs) * intervalMs;
      while (t <= maxTime) {
        xTicksList.push(t);
        t += intervalMs;
      }
    }

    return {
      graphData: data,
      minVal: yMin,
      maxVal: yMax,
      xTicks: xTicksList,
      yTicks: yTicksList,
    };
  }, [
    readings,
    anchor,
    now,
    cgmDelay,
    lowBG,
    highBG,
    recentBoluses,
    recentRescues,
    decimalPredictedBG,
  ]);

  // Measure container width
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const updateWidth = () => {
      if (scrollContainerRef.current) {
        setContainerWidth(scrollContainerRef.current.clientWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(scrollContainerRef.current);
    return () => ro.disconnect();
  }, [showGraph]);

  // Chart width calculation (at least container width, or spaced for smooth horizontal scrolling)
  const pointWidth = 22;
  const totalChartWidth = Math.max(
    containerWidth,
    graphData.length * pointWidth,
  );

  // Auto-scroll to "Now" / future on open
  useEffect(() => {
    if (showGraph && scrollContainerRef.current) {
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft =
            scrollContainerRef.current.scrollWidth;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showGraph]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    const isPast = scrollLeft < scrollWidth - clientWidth - 30;
    setIsScrolledToPast(isPast);
  }, []);

  const scrollToNow = () => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      left: scrollContainerRef.current.scrollWidth,
      behavior: "smooth",
    });
  };

  const renderActualDot = (props: any) => {
    const { cx, cy, payload, key } = props;
    if (
      !cx ||
      !cy ||
      payload?.actual === null ||
      payload?.actual === undefined
    ) {
      return <g key={key} />;
    }

    if (payload.isCalibration) {
      return (
        <polygon
          key={key || `cal-${payload.time}`}
          points={`${cx},${cy - 5} ${cx + 5},${cy} ${cx},${cy + 5} ${cx - 5},${cy}`}
          fill="#e65100"
          stroke="var(--app-surface, #ffffff)"
          strokeWidth={1.5}
        />
      );
    }
    if (payload.isAnchor) {
      return (
        <circle
          key={key || `anchor-${payload.time}`}
          cx={cx}
          cy={cy}
          r={5.5}
          fill="var(--app-primary)"
          stroke="var(--app-surface, #ffffff)"
          strokeWidth={2}
        />
      );
    }
    return (
      <circle
        key={key || `act-${payload.time}`}
        cx={cx}
        cy={cy}
        r={2.5}
        fill="var(--app-primary)"
        stroke="var(--app-surface, #ffffff)"
        strokeWidth={1}
      />
    );
  };

  const renderPredictedDot = (props: any) => {
    const { cx, cy, payload, key } = props;
    if (
      !cx ||
      !cy ||
      payload?.predicted === null ||
      payload?.predicted === undefined ||
      payload.isAnchor
    ) {
      return <g key={key} />;
    }

    return (
      <circle
        key={key || `pred-${payload.time}`}
        cx={cx}
        cy={cy}
        r={2.5}
        fill="var(--app-surface, #ffffff)"
        stroke="var(--app-primary)"
        strokeWidth={1.5}
      />
    );
  };

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

          {/* Toggle Button: View graph / Hide graph */}
          <div className="d-flex justify-content-between align-items-center pt-1 border-top border-secondary-subtle">
            <button
              type="button"
              className="btn btn-link p-0 text-muted d-inline-flex align-items-center gap-1.5 text-decoration-none border-0"
              style={{ fontSize: "0.78rem" }}
              onClick={() => setShowGraph((prev) => !prev)}
            >
              <MdIcon
                name="show_chart"
                size={16}
                className={showGraph ? "text-primary" : "text-muted"}
              />
              <span className={showGraph ? "fw-semibold text-primary" : ""}>
                {showGraph ? "Hide graph" : "View graph"}
              </span>
              <MdIcon
                name={showGraph ? "expand_less" : "expand_more"}
                size={16}
              />
            </button>
            <span className="text-muted small" style={{ fontSize: "0.75rem" }}>
              {Number.isFinite(delta)
                ? `Net Δ ${(() => {
                    const abs = Math.abs(delta);
                    const numStr = decimalPredictedBG
                      ? abs.toFixed(1)
                      : Math.round(abs).toString();
                    return delta > 0 ? `+${numStr}` : delta < 0 ? `-${numStr}` : numStr;
                  })()} mg/dL`
                : ""}
            </span>
          </div>

          {/* Graph Section */}
          {showGraph && (
            <div className="d-flex flex-column gap-1.5 pt-1">
              {/* Legend & Navigation Bar */}
              <div
                className="d-flex justify-content-between align-items-center flex-wrap gap-1 px-1"
                style={{ fontSize: "0.72rem" }}
              >
                <div className="d-flex align-items-center gap-2.5">
                  <span className="d-inline-flex align-items-center gap-1 text-muted">
                    <span
                      style={{
                        width: 10,
                        height: 2.5,
                        backgroundColor: "var(--app-primary)",
                        borderRadius: 1,
                      }}
                    />
                    <span>Actual</span>
                  </span>
                  <span className="d-inline-flex align-items-center gap-1 text-muted">
                    <span
                      style={{
                        width: 10,
                        height: 2,
                        borderTop: "2px dashed var(--app-primary)",
                      }}
                    />
                    <span>Predicted</span>
                  </span>
                  <span className="d-inline-flex align-items-center gap-1 text-muted">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        backgroundColor: "var(--app-status-target)",
                        opacity: 0.3,
                        borderRadius: 2,
                      }}
                    />
                    <span>
                      Target ({lowBG || 70}–{highBG || 180})
                    </span>
                  </span>
                </div>

                {isScrolledToPast && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary py-0 px-2 d-inline-flex align-items-center gap-1 border-0"
                    style={{ fontSize: "0.72rem", height: 20 }}
                    onClick={scrollToNow}
                    title="Scroll to present"
                  >
                    <span>Now</span>
                    <MdIcon name="arrow_forward" size={13} />
                  </button>
                )}
              </div>

              {/* Scrollable Chart with Fixed Y-Axis */}
              <div
                className="d-flex rounded-3 border p-1"
                style={{
                  position: "relative",
                  width: "100%",
                  height: 215,
                  backgroundColor: "var(--app-surface)",
                  borderColor: "var(--app-border)",
                }}
              >
                {/* Fixed Y-Axis Container */}
                <div style={{ width: 34, flexShrink: 0, height: 205 }}>
                  <ResponsiveContainer width={34} height={205}>
                    <LineChart
                      data={[{ y: minVal }, { y: maxVal }]}
                      margin={{ top: 10, right: 0, bottom: 22, left: 0 }}
                    >
                      <YAxis
                        dataKey="y"
                        domain={[minVal, maxVal]}
                        ticks={yTicks}
                        width={34}
                        tick={{
                          fontSize: 10,
                          fill: "var(--app-text-muted)",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Scrollable Timeline Area */}
                <div
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="glucose-graph-scroll flex-grow-1"
                  style={{
                    overflowX: "auto",
                    overflowY: "hidden",
                    minWidth: 0,
                  }}
                >
                  <div style={{ width: totalChartWidth, height: 205 }}>
                    <ResponsiveContainer width="100%" height={205}>
                      <LineChart
                        data={graphData}
                        margin={{ top: 10, right: 26, bottom: 22, left: 6 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          opacity={0.16}
                          horizontal={true}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          ticks={xTicks}
                          tickFormatter={(t) =>
                            new Date(t).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          }
                          tick={{
                            fontSize: 10,
                            fill: "var(--app-text-muted)",
                          }}
                          axisLine={{ stroke: "var(--app-border)" }}
                          tickLine={{ stroke: "var(--app-border)" }}
                        />
                        <YAxis
                          domain={[minVal, maxVal]}
                          ticks={yTicks}
                          hide={true}
                        />

                        {/* Target Range Band */}
                        <ReferenceArea
                          y1={lowBG || 70}
                          y2={highBG || 180}
                          fill="var(--app-status-target)"
                          fillOpacity={0.07}
                        />

                        {/* Target BG Line */}
                        {targetBG && (
                          <ReferenceLine
                            y={targetBG}
                            stroke="var(--app-status-target)"
                            strokeDasharray="2 2"
                            strokeOpacity={0.35}
                          />
                        )}

                        {/* "Now" Marker */}
                        <ReferenceLine
                          x={now.getTime()}
                          stroke="var(--app-primary)"
                          strokeDasharray="3 3"
                          strokeWidth={1.5}
                          label={{
                            value: "Now",
                            position: "top",
                            fill: "var(--app-primary)",
                            fontSize: 10,
                            fontWeight: "bold",
                          }}
                        />

                        <Tooltip
                          content={
                            <GlucoseTooltip
                              anchor={anchor}
                              now={now}
                              decimalPredictedBG={decimalPredictedBG}
                            />
                          }
                          isAnimationActive={false}
                        />

                        {/* Recorded CGM Line (Solid) */}
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="var(--app-primary)"
                          strokeWidth={2.5}
                          dot={renderActualDot}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                          connectNulls={false}
                        />

                        {/* Predicted Line (Dashed) */}
                        <Line
                          type="monotone"
                          dataKey="predicted"
                          stroke="var(--app-primary)"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={renderPredictedDot}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Milestone Predictions & Trend Summary */}
              <div
                className="d-flex justify-content-between align-items-center pt-2 mt-0.5 border-top border-secondary-subtle gap-2 flex-wrap px-1"
                style={{ fontSize: "0.76rem" }}
              >
                <div>
                  <span className="text-muted">Trend: </span>
                  <span className="fw-semibold">
                    {velocity > 0 ? "+" : ""}
                    {decimalPredictedBG
                      ? round(velocity, 1).toFixed(1)
                      : Math.round(velocity).toString()}{" "}
                    mg/dL/hr
                  </span>
                </div>
                <div>
                  <span className="text-muted">+30m: </span>
                  <span className="fw-bold">
                    {pred30 !== null
                      ? `${decimalPredictedBG ? round(pred30, 1).toFixed(1) : Math.round(pred30).toString()} mg/dL`
                      : "--"}
                  </span>
                  {delta30 !== null && (
                    <span
                      className="ms-1 small"
                      style={{
                        color:
                          delta30 > 0
                            ? "var(--app-status-elevated)"
                            : "var(--app-status-target)",
                      }}
                    >
                      ({(() => {
                        const abs = Math.abs(delta30);
                        const str = decimalPredictedBG
                          ? abs.toFixed(1)
                          : Math.round(abs).toString();
                        return delta30 > 0
                          ? `+${str}`
                          : delta30 < 0
                            ? `-${str}`
                            : str;
                      })()})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted">+60m: </span>
                  <span className="fw-bold">
                    {pred60 !== null
                      ? `${decimalPredictedBG ? round(pred60, 1).toFixed(1) : Math.round(pred60).toString()} mg/dL`
                      : "--"}
                  </span>
                  {delta60 !== null && (
                    <span
                      className="ms-1 small"
                      style={{
                        color:
                          delta60 > 0
                            ? "var(--app-status-elevated)"
                            : "var(--app-status-target)",
                      }}
                    >
                      ({(() => {
                        const abs = Math.abs(delta60);
                        const str = decimalPredictedBG
                          ? abs.toFixed(1)
                          : Math.round(abs).toString();
                        return delta60 > 0
                          ? `+${str}`
                          : delta60 < 0
                            ? `-${str}`
                            : str;
                      })()})
                    </span>
                  )}
                </div>
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
