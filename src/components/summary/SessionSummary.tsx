import React, { useMemo } from "react";
import type Session from "../../models/session";
import type MealTemplate from "../../models/mealTemplate";
import { round } from "../../lib/util";
import {
  getFormattedTime,
  getMinuteDiff,
  getPrettyTime,
} from "../../lib/timing";
import { useNow } from "../../state/useNow";
import MealSummary from "./MealSummary";
import Card from "../Card";

export interface SessionSummaryProps {
  session: Session;
  template: MealTemplate;
  currentBG?: number;
  contained?: boolean;
  showMealSummary?: boolean;
  className?: string;
}

function formatDose(value: number) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  session,
  template,
  currentBG,
  contained = false,
  showMealSummary = true,
  className = "",
}) => {
  const now = useNow(60);

  const elapsedMinutes = useMemo(
    () => getMinuteDiff(now, session.timestamp),
    [now, session.timestamp],
  );
  const elapsedFormatted = getFormattedTime(elapsedMinutes);

  const durationFormatted = useMemo(() => {
    return getFormattedTime(Math.round(session.length * 60));
  }, [session.length]);

  const lastInsulin = useMemo(() => {
    if (session.insulins.length === 0) return null;
    const latest = session.insulins[session.insulins.length - 1];
    const diff = getMinuteDiff(now, session.latestInsulinTimestamp);
    return {
      value: latest.value,
      variantName: latest.variant.name,
      timeAgo: `${getFormattedTime(diff)} ago`,
      prettyTime: getPrettyTime(session.latestInsulinTimestamp),
    };
  }, [session.insulins, session.latestInsulinTimestamp, now]);

  const lastGlucose = useMemo(() => {
    if (session.glucoses.length === 0) return null;
    const latest = session.glucoses[session.glucoses.length - 1];
    const diff = getMinuteDiff(now, session.latestGlucoseTimestamp);
    return {
      value: latest.value,
      variantName: latest.variant.name,
      timeAgo: `${getFormattedTime(diff)} ago`,
      prettyTime: getPrettyTime(session.latestGlucoseTimestamp),
    };
  }, [session.glucoses, session.latestGlucoseTimestamp, now]);

  const content = (
    <div className={`app-discrete-summary ${className}`.trim()}>
      {/* Meal Summary OR Session Header */}
      {showMealSummary && session.meal ? (
        <MealSummary
          meal={session.meal}
          mealName={template?.name || "Meal"}
          template={template}
          contained={false}
          statusBadge={
            <span
              className={`badge ${
                session.completed
                  ? "bg-secondary-subtle text-secondary-emphasis"
                  : "bg-success-subtle text-success"
              } fw-semibold px-2 py-0.5 rounded-pill`}
              style={{ fontSize: "0.72rem" }}
            >
              {session.completed ? "Completed" : `Active · ${elapsedFormatted}`}
            </span>
          }
        />
      ) : (
        <div className="app-discrete-header">
          <div>
            <h2 className="app-discrete-title">
              {template?.name || "Active Session"}
            </h2>
            <div className="app-discrete-subtitle">
              Started {getPrettyTime(session.timestamp)} · {durationFormatted}
            </div>
          </div>
          <span
            className={`badge ${
              session.completed
                ? "bg-secondary-subtle text-secondary-emphasis"
                : "bg-success-subtle text-success"
            } fw-semibold px-2 py-0.5 rounded-pill`}
            style={{ fontSize: "0.72rem" }}
          >
            {session.completed ? "Completed" : `Active · ${elapsedFormatted}`}
          </span>
        </div>
      )}

      {/* Timing & Baseline Strip */}
      <div className="app-stat-strip">
        <div className="app-stat-strip-item">
          <span className="stat-label">Start</span>
          <span className="stat-value">{getPrettyTime(session.timestamp)}</span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Start BG</span>
          <span className="stat-value">
            {session.initialGlucose
              ? `${session.initialGlucose} mg/dL`
              : currentBG
                ? `${currentBG} mg/dL`
                : "—"}
          </span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Length</span>
          <span className="stat-value">{durationFormatted}</span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Date</span>
          <span className="stat-value">
            {new Date(session.timestamp).toLocaleDateString(undefined, {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Dosing & Treatment Totals Strip */}
      <div className="app-stat-strip">
        <div className="app-stat-strip-item">
          <span className="stat-label">Total Insulin</span>
          <span className="stat-value">{formatDose(session.insulin)}u</span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Total Glucose</span>
          <span className="stat-value">
            {session.glucose > 0 ? `${session.glucose.toFixed(1)}g` : "0g"}
          </span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Last Bolus</span>
          <span className="stat-value">
            {lastInsulin ? (
              <>
                {formatDose(lastInsulin.value)}u
                <span className="stat-sub">{lastInsulin.timeAgo}</span>
              </>
            ) : (
              <span className="text-muted fw-normal">None</span>
            )}
          </span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Last Glucose</span>
          <span className="stat-value">
            {lastGlucose ? (
              <>
                {lastGlucose.value}g
                <span className="stat-sub">{lastGlucose.timeAgo}</span>
              </>
            ) : (
              <span className="text-muted fw-normal">None</span>
            )}
          </span>
        </div>
      </div>

      {/* Treatment Windows */}
      {session.windows.length > 0 && (
        <div className="d-flex flex-column gap-2 mt-1">
          <div className="px-0.5">
            <span
              className="text-uppercase text-muted fw-bold"
              style={{ fontSize: "0.74rem", letterSpacing: "0.05em" }}
            >
              Treatment Windows ({session.windows.length})
            </span>
          </div>
          <div className="app-dose-list">
            {session.windows.map((window, i) => {
              const windowInsulin = session.insulins[i];
              return (
                <div key={i} className="app-dose-item">
                  <span className="dose-name">
                    <span
                      className="badge bg-body-secondary text-body fw-bold rounded-pill px-2 py-0.5"
                      style={{ fontSize: "0.78rem" }}
                    >
                      W{i + 1}
                    </span>
                    <span>
                      {window.initialBG} → {window.finalBG} mg/dL
                    </span>
                    {windowInsulin && (
                      <span className="opacity-75 ms-1">
                        · {windowInsulin.value.toFixed(1)}u{" "}
                        {windowInsulin.variant.name}
                      </span>
                    )}
                  </span>
                  <span className="d-flex align-items-center gap-2 flex-shrink-0">
                    {window.glucoses.length > 0 && (
                      <span
                        className="badge bg-warning-subtle text-warning-emphasis fw-bold rounded-pill px-2 py-0.5"
                        style={{ fontSize: "0.78rem" }}
                      >
                        +{window.glucoses.reduce((s, g) => s + g.value, 0)}g
                      </span>
                    )}
                    <span
                      className="text-muted fw-medium"
                      style={{ fontSize: "0.85rem" }}
                    >
                      {getFormattedTime(Math.round(window.length * 60))}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activities */}
      {session.activities.length > 0 && (
        <div className="d-flex flex-column gap-2 mt-1">
          <div className="px-0.5">
            <span
              className="text-uppercase text-muted fw-bold"
              style={{ fontSize: "0.74rem", letterSpacing: "0.05em" }}
            >
              Activities
            </span>
          </div>
          <div className="app-dose-list">
            {session.activities.map((a, i) => (
              <div key={i} className="app-dose-item">
                <span className="dose-name">{a.name}</span>
                <span className="dose-value fw-medium" style={{ fontSize: "0.92rem" }}>
                  {getFormattedTime(a.length)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flags & Notes */}
      {(template?.isFirstTime || session.isInvalid || session.notes) && (
        <div className="d-flex flex-column gap-1 pt-1">
          {template?.isFirstTime && (
            <div
              className="text-warning-emphasis d-flex align-items-center gap-1"
              style={{ fontSize: "0.75rem" }}
            >
              <i className="bi bi-info-circle" />
              <span>First time using this template</span>
            </div>
          )}
          {session.isInvalid && (
            <div
              className="text-danger-emphasis d-flex align-items-center gap-1"
              style={{ fontSize: "0.75rem" }}
            >
              <i className="bi bi-exclamation-triangle" />
              <span>Session is currently invalid</span>
            </div>
          )}
          {session.notes && (
            <div
              className="text-muted fst-italic"
              style={{ fontSize: "0.75rem" }}
            >
              {session.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (contained) {
    return <Card className={className}>{content}</Card>;
  }

  return content;
};

export default SessionSummary;
