import { useMemo } from "react";
import { useNavigate } from "react-router";
import MdIcon from "../md3/MdIcon";
import HealthMonitorStatus from "../../models/types/healthMonitorStatus";
import { HealthMonitorStore } from "../../storage/healthMonitorStore";
import { ExpirationStore } from "../../storage/expirationStore";
import { WizardStore } from "../../storage/wizardStore";
import { timeToCritical } from "../../lib/healthMonitor";
import { getDailyBasalPerShot, getLastShot } from "../../lib/basal";
import { getFormattedTime } from "../../lib/timing";
import WizardManager from "../../managers/wizardManager";
import { InsulinExpirationManager } from "../../managers/expirationManager";
import { formatDose, type GlucoseRange } from "./glucoseFormat";
import type { GlucosePoint } from "./useGlucoseForecast";

type AlertTone = "low" | "high" | "neutral";

interface HubAlert {
  id: string;
  tone: AlertTone;
  icon: string;
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
  onClick?: () => void;
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
  const [status] = HealthMonitorStore.statusCache.useState();
  const [currentBG] = HealthMonitorStore.currentBG.useState();
  const [expirations] = ExpirationStore.expirations.useState();

  const alerts = useMemo<HubAlert[]>(() => {
    const list: HubAlert[] = [];
    const toRescue = { label: "Rescue", onClick: () => navigate("/rescue") };

    // Glucose
    if (status === HealthMonitorStatus.Falling) {
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
            WizardStore.isPrebolus.value = false;
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
                    WizardManager.markBasal(dose, new Date());
                    onBasalMarked();
                  }
                },
              }
            : { label: "Log", onClick: () => navigate("/basal") },
      });
    }

    // Supplies
    const expired = InsulinExpirationManager.getExpired();
    if (expired.length > 0) {
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
    navigate,
    onBasalMarked,
    onRefresh,
  ]);

  if (alerts.length === 0) return null;

  return (
    <div className="hub-alerts" role="status">
      {alerts.map((a) => (
        <div key={a.id} className={`hub-alert hub-alert-${a.tone}`}>
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
        </div>
      ))}
    </div>
  );
}
