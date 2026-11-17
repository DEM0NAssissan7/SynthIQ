import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import MdIcon from "../md3/MdIcon";
import RollingCounter from "../RollingCounter";
import MdModalBottomSheet from "../md3/MdModalBottomSheet";
import LastBolusMessage from "../LastBolusMessage";
import SessionSummary from "../summary/SessionSummary";
import { useNow } from "../../state/useNow";
import { PreferencesStore } from "../../storage/preferencesStore";
import { HealthMonitorStore } from "../../storage/healthMonitorStore";
import { BasalStore } from "../../storage/basalStore";
import { WizardStore } from "../../storage/wizardStore";
import { ActivityStore } from "../../storage/activityStore";
import { basalIsDue, populateReadingCache } from "../../lib/healthMonitor";
import { getFormattedTime, getHourDiff, getMinuteDiff } from "../../lib/timing";
import { round } from "../../lib/util";
import {
  formatBG,
  formatClock,
  formatDose,
  formatDuration,
  formatRelative,
  getDeltaTrend,
  getGlucoseStatus,
  toneColor,
  type GlucoseRange,
} from "./glucoseFormat";
import {
  FORECAST_HORIZON_MS,
  interpolateAt,
  useGlucoseForecast,
  type GlucosePoint,
} from "./useGlucoseForecast";
import GlucoseGraph, { type ScrubPoint } from "./GlucoseGraph";
import HubAlerts from "./HubAlerts";
import {
  buildHubEvents,
  eventIcon,
  eventKindPlural,
  markerLabel,
  activityScaleReach,
  totalActivity,
  totalIOB,
  type HubEvent,
  type MealSession,
} from "./hubEvents";
import HubMealDetails from "./HubMealDetails";

const IOB_SAMPLE_MS = 5 * 60 * 1000;
// Finer than IOB: the activity curve has a peak whose shape matters.
const ACTIVITY_SAMPLE_MS = 2 * 60 * 1000;

type Sheet =
  | { type: "event"; event: HubEvent }
  | { type: "group"; events: HubEvent[] }
  | { type: "iob" }
  | { type: "accuracy" }
  | { type: "session" };

/** Arrow rotated continuously with the CGM rate: flat at 0, vertical at ±2 mg/dL/min. */
function TrendArrow({ velocity, color }: { velocity: number; color: string }) {
  const perMin = velocity / 60;
  const angle = -Math.max(-1, Math.min(1, perMin / 2)) * 90;
  return (
    <span
      className="hub-trend-arrow"
      style={{ backgroundColor: color }}
      role="img"
      aria-label={`${velocity > 0 ? "Rising" : velocity < 0 ? "Falling" : "Steady"} ${Math.abs(Math.round(velocity))} mg/dL per hour`}
    >
      <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
        <g transform={`rotate(${angle} 12 12)`}>
          <path
            d="M4 12h14M13 6.5 18.5 12 13 17.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </span>
  );
}

/** Height of the app's fixed bottom navigation bar. */
function useBottomNavHeight() {
  const [height, setHeight] = useState(96);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".app-bottom-nav");
    if (!nav) return;
    const update = () => setHeight(nav.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);
  return height;
}

/** Bottom sheet rendered at <body> so it layers above the fixed hub and nav. */
function HubSheet(props: {
  show: boolean;
  onHide: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  return createPortal(<MdModalBottomSheet {...props} />, document.body);
}

export default function HubScreen() {
  const navigate = useNavigate();
  const now = useNow(5);
  const nowMs = now.getTime();
  const navHeight = useBottomNavHeight();

  const [targetBG] = PreferencesStore.targetBG.useState();
  const [lowBG] = PreferencesStore.lowBG.useState();
  const [highBG] = PreferencesStore.highBG.useState();
  const [dangerBG] = PreferencesStore.dangerBG.useState();
  const [decimal] = PreferencesStore.decimalPredictedBG.useState();
  const [basalDoses] = BasalStore.basalDoses.useState();
  const [session] = WizardStore.session.useState();
  const [template] = WizardStore.activeTemplate.useState();
  const [templates] = WizardStore.templates.useState();
  const [fingerstickReadings] = HealthMonitorStore.fingersticks.useState();
  const fingersticks = useMemo<GlucosePoint[]>(
    () =>
      fingerstickReadings.map((r) => ({
        time: r.timestamp.getTime(),
        value: r.sugar,
      })),
    [fingerstickReadings],
  );
  const [currentActivity] = ActivityStore.activity.useState();

  const range: GlucoseRange = useMemo(
    () => ({
      targetBG: targetBG || 110,
      lowBG: lowBG || 70,
      highBG: highBG || 180,
      dangerBG: dangerBG || 55,
    }),
    [targetBG, lowBG, highBG, dangerBG],
  );

  const {
    history,
    anchor,
    forecast,
    predictedNow,
    velocity,
    accuracy,
    stepMs,
    boluses,
    rescues,
    basalTimes,
  } = useGlucoseForecast(now);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // The hub is a fixed full-screen view; the page behind it shouldn't scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    populateReadingCache();
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await populateReadingCache();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  }, []);

  const [dueForBasal, setDueForBasal] = useState(basalIsDue());
  const nowMinute = Math.floor(nowMs / 60000);
  useEffect(() => {
    setDueForBasal(basalIsDue());
  }, [nowMinute, basalDoses]);
  const onBasalMarked = useCallback(() => setDueForBasal(false), []);

  const openSheet = useCallback((s: Sheet) => {
    setSheet(s);
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Earliest time the graph can scroll back to.
  const earliestMs = useMemo(() => {
    const oldest = history.length > 0 ? history[0].time : nowMinute * 60000;
    return Math.min(oldest, nowMinute * 60000 - 3 * 3_600_000);
  }, [history, nowMinute]);

  // Meals: every session with a meal, from the templates plus the current one.
  const mealSessions = useMemo<MealSession[]>(() => {
    const byId = new Map<MealSession["session"]["uuid"], MealSession>();
    for (const t of templates)
      for (const s of t._sessions)
        if (s.meal) byId.set(s.uuid, { session: s, name: t.name });
    if (session.meal)
      byId.set(session.uuid, { session, name: template?.name || "Meal" });
    return Array.from(byId.values()).filter(
      (m) => m.session.meal!.timestamp.getTime() >= earliestMs,
    );
  }, [templates, session, template, earliestMs]);

  const events = useMemo(() => {
    const activities = [...session.activities];
    const currentStart =
      currentActivity.snapshot.initialBG?.timestamp.getTime();
    if (
      currentStart !== undefined &&
      !activities.some(
        (a) => a.snapshot.initialBG?.timestamp.getTime() === currentStart,
      )
    ) {
      activities.push(currentActivity);
    }
    return buildHubEvents({
      boluses,
      rescues,
      mealSessions,
      basalDoses,
      basalTimes,
      activities,
      nowMs: nowMinute * 60000,
    });
  }, [
    boluses,
    rescues,
    mealSessions,
    basalDoses,
    basalTimes,
    session,
    currentActivity,
    nowMinute,
  ]);

  // IOB on a fixed 5-min grid over the whole scrollable range.
  const iobSamples = useMemo<GlucosePoint[]>(() => {
    const samples: GlucosePoint[] = [];
    const end = nowMinute * 60000 + FORECAST_HORIZON_MS + IOB_SAMPLE_MS;
    for (
      let t = Math.floor(earliestMs / IOB_SAMPLE_MS) * IOB_SAMPLE_MS;
      t <= end;
      t += IOB_SAMPLE_MS
    ) {
      samples.push({ time: t, value: totalIOB(boluses, t) });
    }
    return samples;
  }, [boluses, earliestMs, nowMinute]);

  // Insulin activity (absorption rate, u/hr). Sampled beyond the scrollable
  // range by the activity scale's reach, so the scale can always see it.
  const activityReach = useMemo(() => activityScaleReach(boluses), [boluses]);
  const activitySamples = useMemo<GlucosePoint[]>(() => {
    const samples: GlucosePoint[] = [];
    const end =
      nowMinute * 60000 +
      FORECAST_HORIZON_MS +
      activityReach.aheadMs +
      ACTIVITY_SAMPLE_MS;
    const start = earliestMs - activityReach.backMs;
    for (
      let t = Math.floor(start / ACTIVITY_SAMPLE_MS) * ACTIVITY_SAMPLE_MS;
      t <= end;
      t += ACTIVITY_SAMPLE_MS
    ) {
      samples.push({ time: t, value: totalActivity(boluses, t) });
    }
    return samples;
  }, [boluses, earliestMs, nowMinute, activityReach]);

  // Snap scrub: nearest CGM reading or fingerstick up to the anchor,
  // interpolated forecast after.
  const scrub = useMemo<ScrubPoint | null>(() => {
    if (scrubTime === null || !anchor) return null;
    if (scrubTime <= anchor.time) {
      let best: ScrubPoint | null = null;
      const consider = (p: GlucosePoint, source: ScrubPoint["source"]) => {
        if (
          !best ||
          Math.abs(p.time - scrubTime) < Math.abs(best.time - scrubTime)
        )
          best = { time: p.time, value: p.value, source };
      };
      for (const p of history)
        consider(p, p.isCalibration ? "calibration" : "cgm");
      for (const p of fingersticks) consider(p, "fingerstick");
      return best;
    }
    const last = forecast.length > 0 ? forecast[forecast.length - 1].time : 0;
    const t = Math.min(Math.round(scrubTime / 60000) * 60000, last);
    const v = interpolateAt(forecast, t);
    if (v === null) return null;
    return { time: t, value: v, source: "predicted" };
  }, [scrubTime, anchor, history, fingersticks, forecast]);

  const minutesAgo = anchor ? Math.max(0, (nowMs - anchor.time) / 60000) : 0;
  const isStale = anchor !== null && nowMs - anchor.time > stepMs * 3;
  const shownValue = scrub ? scrub.value : predictedNow;
  const status = getGlucoseStatus(shownValue, range);
  const trend =
    anchor && predictedNow !== null
      ? getDeltaTrend({
          startBG: anchor.value,
          predictedBG: predictedNow,
          range,
          decimal,
          durationMinutes: Math.max(minutesAgo, 1),
        })
      : null;
  const iobNow = totalIOB(boluses, nowMs);

  const sourceLabel: Record<ScrubPoint["source"], string> = {
    cgm: "CGM reading",
    calibration: "Calibration",
    fingerstick: "Fingerstick",
    predicted: "Predicted",
  };

  const latestBasal = basalDoses[0] ?? null;
  const sessionName =
    template?.name || (session.meal ? "Meal" : "Active session");
  const sessionParts = [
    session.meal && session.meal.carbs > 0
      ? `${Math.round(session.meal.carbs)}g`
      : null,
    `${formatDose(session.insulin)}u`,
    session.glucose > 0 ? `+${round(session.glucose, 1)}g` : null,
  ].filter(Boolean);

  function setExcluded(value: boolean) {
    if (value && !confirm("Do you want to mark this session as unreliable?"))
      return;
    session.isGarbage = value;
    WizardStore.session.write();
  }

  return (
    <div className="hub-screen" style={{ bottom: navHeight }}>
      {/* Reading */}
      <header className="hub-header">
        {anchor && predictedNow !== null ? (
          <>
            <div className="hub-reading-row">
              <div className="hub-reading-value">
                {scrub ? (
                  <span className="hub-reading-number">
                    {formatBG(scrub.value, decimal)}
                  </span>
                ) : (
                  <RollingCounter
                    value={predictedNow}
                    decimals={decimal ? 1 : 0}
                    className="hub-reading-number"
                  />
                )}
                <span className="hub-reading-unit">mg/dL</span>
                {!scrub && status && (
                  <TrendArrow
                    velocity={velocity}
                    color={toneColor[status.tone]}
                  />
                )}
              </div>
              <div className="hub-reading-side">
                {status && (
                  <span className={`hub-status-chip hub-tone-${status.tone}`}>
                    {status.label}
                  </span>
                )}
                <button
                  type="button"
                  className="hub-icon-btn"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label="Refresh CGM data"
                >
                  <MdIcon
                    name="sync"
                    size={20}
                    className={isRefreshing ? "spin-animation" : ""}
                  />
                </button>
              </div>
            </div>
            <div className="hub-reading-caption" aria-live="polite">
              {scrub ? (
                <>
                  <strong>{formatClock(scrub.time)}</strong>
                  {" · "}
                  {formatRelative(scrub.time, nowMs)}
                  {" · "}
                  {sourceLabel[scrub.source]}
                </>
              ) : (
                <>
                  Estimated now
                  {trend &&
                    trend.formatted !== "0" &&
                    trend.formatted !== "0.0" && (
                      <>
                        {" · "}
                        <span style={{ color: trend.color, fontWeight: 600 }}>
                          {trend.formatted}
                        </span>{" "}
                        since CGM
                      </>
                    )}
                </>
              )}
            </div>
            <div className="hub-meta-row">
              <span className={`hub-meta-cgm ${isStale ? "is-stale" : ""}`}>
                CGM {formatBG(anchor.value, false)} ·{" "}
                {getFormattedTime(Math.round(minutesAgo))} ago
                {Math.abs(velocity) >= 1 &&
                  ` · ${velocity > 0 ? "+" : ""}${Math.round(velocity)}/hr`}
              </span>
              <div className="hub-meta-actions">
                {accuracy && (
                  <button
                    type="button"
                    className="hub-meta-chip"
                    onClick={() => openSheet({ type: "accuracy" })}
                    aria-label="Forecast accuracy details"
                  >
                    ±{formatBG(accuracy.meanAvgDeviation, decimal)}
                  </button>
                )}
                <button
                  type="button"
                  className="hub-meta-chip hub-meta-chip-iob"
                  onClick={() => openSheet({ type: "iob" })}
                  aria-label="Insulin on board details"
                >
                  <MdIcon name="syringe" size={14} fill />
                  {formatDose(iobNow)}u
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="hub-empty">
            <MdIcon name="ecg_heart" size={28} className="text-muted" />
            <div>No recent CGM readings to build a forecast from.</div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              Refresh
            </button>
          </div>
        )}
      </header>

      <HubAlerts
        nowMs={nowMs}
        range={range}
        predictedNow={predictedNow}
        forecast={forecast}
        anchorTime={anchor?.time ?? null}
        stepMs={stepMs}
        dueForBasal={dueForBasal}
        onBasalMarked={onBasalMarked}
        onRefresh={handleRefresh}
      />

      {/* Graph */}
      {anchor && (
        <GlucoseGraph
          history={history}
          fingersticks={fingersticks}
          forecast={forecast}
          anchorTime={anchor.time}
          nowMs={nowMs}
          horizonMs={FORECAST_HORIZON_MS}
          earliestMs={earliestMs}
          stepMs={stepMs}
          range={range}
          decimal={decimal}
          events={events}
          iobSamples={iobSamples}
          activitySamples={activitySamples}
          activityReach={activityReach}
          iobNow={iobNow}
          scrub={scrub}
          onScrub={setScrubTime}
          onEventTap={(event) => openSheet({ type: "event", event })}
          onGroupTap={(events) => openSheet({ type: "group", events })}
          onIOBTap={() => openSheet({ type: "iob" })}
        />
      )}

      {/* Dock */}
      <div className="hub-dock">
        {session.started && (
          <button
            type="button"
            className="hub-dock-chip"
            onClick={() => openSheet({ type: "session" })}
          >
            <span className="hub-dock-icon hub-kind-meal">
              <MdIcon name="restaurant" size={16} fill />
            </span>
            <span className="hub-dock-text">
              <strong>
                {sessionName}
                {session.isGarbage && " · Excluded"}
              </strong>
              <small>
                {session.completed
                  ? "Completed"
                  : formatDuration(getMinuteDiff(now, session.timestamp))}
                {" · "}
                {sessionParts.join(" · ")}
              </small>
            </span>
          </button>
        )}
        {!dueForBasal && (
          <button
            type="button"
            className="hub-dock-chip"
            onClick={() => navigate("/basal")}
          >
            <span className="hub-dock-icon hub-kind-basal">
              <MdIcon name="shield_with_heart" size={16} fill />
            </span>
            <span className="hub-dock-text">
              <strong>Basal</strong>
              <small>
                {latestBasal
                  ? `${formatDose(latestBasal.value)}u · ${round(getHourDiff(now, latestBasal.timestamp), 1)}h ago`
                  : "On schedule"}
              </small>
            </span>
          </button>
        )}
      </div>

      <HubSheet
        show={sheetOpen}
        onHide={closeSheet}
        title={
          sheet?.type === "event" ? (
            <span className="d-inline-flex align-items-center gap-2">
              <span className={`hub-sheet-icon hub-kind-${sheet.event.kind}`}>
                <MdIcon name={eventIcon[sheet.event.kind]} size={18} fill />
              </span>
              {sheet.event.title}
            </span>
          ) : sheet?.type === "group" ? (
            sheet.events.every((e) => e.kind === sheet.events[0].kind) ? (
              sheet.events[0].kind === "meal" ? (
                `${sheet.events.length} meals`
              ) : (
                `${sheet.events.length} ${eventKindPlural[sheet.events[0].kind]} · ${markerLabel(sheet.events)}`
              )
            ) : (
              `${sheet.events.length} treatments`
            )
          ) : sheet?.type === "iob" ? (
            "Active insulin"
          ) : sheet?.type === "accuracy" ? (
            "Forecast accuracy"
          ) : sheet?.type === "session" ? (
            sessionName
          ) : null
        }
      >
        {sheet?.type === "event" && sheet.event.session && (
          <HubMealDetails
            session={sheet.event.session}
            nowMs={nowMs}
            onNavigate={closeSheet}
          />
        )}
        {sheet?.type === "event" && !sheet.event.session && (
          <div className="hub-sheet-rows">
            {sheet.event.details.map((d) => (
              <div key={d.label} className="hub-sheet-row">
                <span>{d.label}</span>
                <span>{d.value}</span>
              </div>
            ))}
          </div>
        )}
        {sheet?.type === "group" && (
          <div className="hub-sheet-actions">
            {sheet.events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className="hub-sheet-action"
                onClick={() => openSheet({ type: "event", event: ev })}
              >
                <span className={`hub-sheet-icon hub-kind-${ev.kind}`}>
                  <MdIcon name={eventIcon[ev.kind]} size={18} fill />
                </span>
                <span className="flex-grow-1">
                  <strong>{ev.title}</strong>
                  <small>{ev.details[0]?.value}</small>
                </span>
                <span className="hub-sheet-amount">{ev.label}</span>
              </button>
            ))}
          </div>
        )}
        {sheet?.type === "iob" && <LastBolusMessage />}
        {sheet?.type === "accuracy" && accuracy && (
          <>
            <p className="text-muted small mb-3">
              How far the forecast has landed from actual CGM readings over the
              last 2 hours.
            </p>
            <div className="hub-sheet-rows">
              <div className="hub-sheet-row">
                <span>Mean deviation</span>
                <span>
                  ±{formatBG(accuracy.meanAvgDeviation, decimal)} mg/dL
                </span>
              </div>
              <div className="hub-sheet-row">
                <span>At +30 min</span>
                <span>
                  {accuracy.meanDeviation30min !== null
                    ? `±${formatBG(accuracy.meanDeviation30min, decimal)} mg/dL`
                    : "—"}
                </span>
              </div>
              <div className="hub-sheet-row">
                <span>At +60 min</span>
                <span>
                  {accuracy.meanDeviation60min !== null
                    ? `±${formatBG(accuracy.meanDeviation60min, decimal)} mg/dL`
                    : "—"}
                </span>
              </div>
              <div className="hub-sheet-row">
                <span>Within variance</span>
                <span>
                  {round(accuracy.percentWithinVariance, decimal ? 1 : 0)}%
                </span>
              </div>
              <div className="hub-sheet-row">
                <span>Exactly correct</span>
                <span>{round(accuracy.percentCorrect, decimal ? 1 : 0)}%</span>
              </div>
            </div>
          </>
        )}
        {sheet?.type === "session" && session.started && (
          <>
            <SessionSummary
              session={session}
              template={template}
              contained={false}
            />
            <div className="hub-sheet-actions mt-3">
              <button
                type="button"
                className="hub-sheet-action"
                onClick={() => {
                  closeSheet();
                  navigate("/session/edit");
                }}
              >
                <MdIcon name="edit_note" size={22} />
                <span>
                  <strong>Edit session</strong>
                  <small>
                    Adjust stored foods, treatments, or glucose details.
                  </small>
                </span>
              </button>
              <button
                type="button"
                className={`hub-sheet-action ${session.isGarbage ? "" : "is-danger"}`}
                onClick={() => setExcluded(!session.isGarbage)}
              >
                <MdIcon
                  name={session.isGarbage ? "check_circle" : "warning"}
                  size={22}
                />
                <span>
                  <strong>
                    {session.isGarbage ? "Include session" : "Exclude session"}
                  </strong>
                  <small>
                    {session.isGarbage
                      ? "Use this session for learning again."
                      : "Mark as unreliable so it isn't learned from."}
                  </small>
                </span>
              </button>
            </div>
          </>
        )}
      </HubSheet>
    </div>
  );
}
