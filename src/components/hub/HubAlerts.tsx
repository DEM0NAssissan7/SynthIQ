import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import MdIcon from "../md3/MdIcon";
import HealthMonitorStatus from "../../models/types/healthMonitorStatus";
import { ExpirationStore } from "../../storage/expirationStore";
import {
  getCurrentBG,
  getHealthMonitorStatus,
  getRecentRescues,
  timeToCritical,
} from "../../lib/healthMonitor";
import { useStream } from "../../state/useStream";
import { getDailyBasalPerShot, getLastShot } from "../../lib/basal";
import { getFormattedTime } from "../../lib/timing";
import { InsulinExpirationManager } from "../../managers/expirationManager";
import { formatDose, type GlucoseRange } from "./glucoseFormat";
import type { GlucosePoint } from "./useGlucoseForecast";
import { EntryStore } from "../../storage/entryStore";
import { InjectionPurpose } from "../../models/events/insulin";
import { StreamManager } from "../../managers/streamManager";

type AlertTone = "low" | "high" | "neutral";

interface HubAlert {
  id: string;
  tone: AlertTone;
  icon: string;
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
  onClick?: () => void;
  /** Swipe (or ×) to dismiss. */
  onDismiss?: () => void;
}

/** Identity of the current set of expired insulins. */
function expiredAlertKey(
  expired: { fullName: string; openDate: Date }[],
): string {
  return expired
    .map((e) => `${e.fullName}@${e.openDate.getTime()}`)
    .sort()
    .join("|");
}

const DISMISS_FRACTION = 0.35;
const DISMISS_VELOCITY = 0.5; // px/ms

/** Alert row that can be flung sideways to dismiss. */
function SwipeToDismiss({
  onDismiss,
  className,
  children,
}: {
  onDismiss: () => void;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    x0: number;
    y0: number;
    lastX: number;
    lastT: number;
    v: number;
    active: boolean;
  } | null>(null);
  const moved = useRef(false);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const [settling, setSettling] = useState(false);

  const leave = (dir: 1 | -1) => {
    setSettling(true);
    setLeaving(dir);
    window.setTimeout(onDismiss, 220);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    moved.current = false;
    setSettling(false);
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      lastX: e.clientX,
      lastT: performance.now(),
      v: 0,
      active: false,
    };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const ddx = e.clientX - d.x0;
    if (!d.active) {
      // Horizontal intent only; vertical movement is left to the page.
      if (Math.abs(ddx) < 8 || Math.abs(ddx) < Math.abs(e.clientY - d.y0))
        return;
      d.active = true;
      moved.current = true;
      ref.current?.setPointerCapture?.(e.pointerId);
    }
    const now = performance.now();
    d.v = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    setDx(ddx);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.active) return;
    const width = ref.current?.offsetWidth ?? 300;
    const ddx = e.clientX - d.x0;
    if (
      Math.abs(ddx) > width * DISMISS_FRACTION ||
      (Math.abs(d.v) > DISMISS_VELOCITY && Math.sign(d.v) === Math.sign(ddx))
    ) {
      leave(ddx > 0 ? 1 : -1);
    } else {
      setSettling(true);
      setDx(0);
    }
  };

  const offset = leaving !== 0 ? `${leaving * 110}%` : `${dx}px`;
  return (
    <div
      ref={ref}
      className={`${className} hub-alert-swipe ${settling ? "is-settling" : ""}`}
      style={{
        transform: `translate3d(${offset}, 0, 0)`,
        opacity:
          leaving !== 0
            ? 0
            : 1 -
              Math.min(
                0.6,
                Math.abs(dx) / ((ref.current?.offsetWidth ?? 300) * 1.2),
              ),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(e) => {
        // A drag isn't a tap on the buttons inside.
        if (moved.current) {
          e.stopPropagation();
          e.preventDefault();
          moved.current = false;
        }
      }}
    >
      {children}
    </div>
  );
}

interface Props {
  nowMs: number;
  range: GlucoseRange;
  predictedNow: number | null;
  forecast: GlucosePoint[];
  anchorTime: number | null;
  stepMs: number;
  dueForBasal: boolean;
  onBasalMarked: () => void;
  onRefresh: () => void;
}

/**
 * Things that need attention now, most urgent first. Glucose alerts come
 * from the health monitor's status (the same logic the rest of the app
 * uses) plus the forecast crossing the user's low threshold.
 */
export default function HubAlerts({
  nowMs,
  range,
  predictedNow,
  forecast,
  anchorTime,
  stepMs,
  dueForBasal,
  onBasalMarked,
  onRefresh,
}: Props) {
  const navigate = useNavigate();
  const [stream, streamVersion] = useStream();
  const status = useMemo(
    () => getHealthMonitorStatus(),
    [streamVersion, nowMs],
  );
  const currentBG = useMemo(() => getCurrentBG(stream) ?? 0, [streamVersion]);
  const [expirations] = ExpirationStore.expirations.useState();
  const [dismissedExpired, setDismissedExpired] =
    ExpirationStore.dismissedExpiredAlert.useState();
  const rescues = useMemo(() => getRecentRescues(stream), [streamVersion]);

  const alerts = useMemo<HubAlert[]>(() => {
    const list: HubAlert[] = [];
    const toRescue = { label: "Rescue", onClick: () => navigate("/rescue") };

    // A rescue still within its variant's active duration is already
    // treating the low, so nothing prompts for another one until it ends.
    const rescueActive = rescues.some(
      (r) =>
        nowMs >= r.timestamp.getTime() &&
        nowMs - r.timestamp.getTime() < r.variant.duration * 60000,
    );

    // Glucose
    if (rescueActive) {
      // (no rescue prompts)
    } else if (status === HealthMonitorStatus.Falling) {
      const minutes = timeToCritical();
      list.push({
        id: "falling",
        tone: "low",
        icon: "south",
        title: "Falling fast",
        detail:
          Number.isFinite(minutes) && minutes > 0
            ? `Reaching ${range.dangerBG} mg/dL in about ${minutes} min`
            : undefined,
        action: toRescue,
      });
    } else if (status === HealthMonitorStatus.Low) {
      list.push({
        id: "low",
        tone: "low",
        icon: "warning",
        title: `Low · ${currentBG} mg/dL`,
        detail: `Below ${range.lowBG} mg/dL`,
        action: toRescue,
      });
    } else if (predictedNow !== null && predictedNow < range.lowBG) {
      list.push({
        id: "forecast-low-now",
        tone: "low",
        icon: "warning",
        title: `Estimated below ${range.lowBG} now`,
        detail: "Forecast from the latest CGM reading",
        action: toRescue,
      });
    } else {
      const crossing = forecast.find(
        (p) => p.time > nowMs && p.value < range.lowBG,
      );
      if (crossing) {
        list.push({
          id: "forecast-low",
          tone: "low",
          icon: "south",
          title: "Heading low",
          detail: `Forecast below ${range.lowBG} mg/dL in ${getFormattedTime(Math.round((crossing.time - nowMs) / 60000))}`,
          action: toRescue,
        });
      }
    }
    if (status === HealthMonitorStatus.High) {
      list.push({
        id: "high",
        tone: "high",
        icon: "trending_up",
        title: `High · ${currentBG} mg/dL`,
        detail: `${currentBG - range.highBG} above ${range.highBG} with no bolus on board`,
        action: {
          label: "Insulin",
          onClick: () => {
            EntryStore.injectionPurpose.value = InjectionPurpose.Nominal;
            navigate("/insulin");
          },
        },
      });
    }

    // CGM
    if (anchorTime !== null && nowMs - anchorTime > stepMs * 3) {
      list.push({
        id: "stale",
        tone: "high",
        icon: "sync",
        title: "No recent CGM data",
        detail: `Last reading ${getFormattedTime(Math.round((nowMs - anchorTime) / 60000))} ago`,
        action: { label: "Refresh", onClick: onRefresh },
      });
    }

    // Basal
    if (dueForBasal) {
      const lastShot = getLastShot();
      const fallback = getDailyBasalPerShot();
      const dose =
        lastShot > 0 ? lastShot : Number.isFinite(fallback) ? fallback : 0;
      list.push({
        id: "basal",
        tone: "neutral",
        icon: "shield_with_heart",
        title: "Basal due",
        detail: dose > 0 ? `Usual dose ${formatDose(dose)}u` : undefined,
        onClick: () => navigate("/basal"),
        action:
          dose > 0
            ? {
                label: `Mark ${formatDose(dose)}u`,
                onClick: () => {
                  if (
                    confirm(
                      `Confirm that you have injected ${formatDose(dose)}u of basal insulin`,
                    )
                  ) {
                    StreamManager.markBasal(dose, new Date());
                    onBasalMarked();
                  }
                },
              }
            : { label: "Log", onClick: () => navigate("/basal") },
      });
    }

    // Supplies
    const expired = InsulinExpirationManager.getExpired();
    const expiredKey = expiredAlertKey(expired);
    if (expired.length > 0 && expiredKey !== dismissedExpired) {
      list.push({
        id: "expired",
        tone: "high",
        icon: "hourglass_empty",
        title:
          expired.length === 1
            ? "Insulin expired"
            : `${expired.length} insulins expired`,
        detail: expired.map((e) => e.fullName).join(", "),
        onClick: () => navigate("/expirations"),
        action: { label: "Review", onClick: () => navigate("/expirations") },
        onDismiss: () => setDismissedExpired(expiredKey),
      });
    }
    return list;
    // expirations: re-evaluate when the store changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    currentBG,
    predictedNow,
    forecast,
    nowMs,
    range,
    anchorTime,
    stepMs,
    dueForBasal,
    expirations,
    dismissedExpired,
    setDismissedExpired,
    rescues,
    navigate,
    onBasalMarked,
    onRefresh,
  ]);

  if (alerts.length === 0) return null;

  return (
    <div className="hub-alerts" role="status">
      {alerts.map((a) => {
        const body = (
          <>
            <button
              type="button"
              className="hub-alert-main"
              onClick={a.onClick ?? a.action?.onClick}
            >
              <MdIcon name={a.icon} size={20} fill />
              <span className="hub-alert-text">
                <strong>{a.title}</strong>
                {a.detail && <small>{a.detail}</small>}
              </span>
            </button>
            {a.action && (
              <button
                type="button"
                className="hub-alert-action"
                onClick={a.action.onClick}
              >
                {a.action.label}
              </button>
            )}
            {a.onDismiss && (
              <button
                type="button"
                className="hub-alert-dismiss"
                onClick={a.onDismiss}
                aria-label={`Dismiss: ${a.title}`}
              >
                <MdIcon name="close" size={18} />
              </button>
            )}
          </>
        );
        const className = `hub-alert hub-alert-${a.tone}`;
        return a.onDismiss ? (
          <SwipeToDismiss
            key={a.id}
            className={className}
            onDismiss={a.onDismiss}
          >
            {body}
          </SwipeToDismiss>
        ) : (
          <div key={a.id} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
