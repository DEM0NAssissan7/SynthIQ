import React, { useMemo } from "react";
import type Session from "../../models/session";
import type MealTemplate from "../../models/mealTemplate";
import { round } from "../../lib/util";
import {
  getFormattedTime,
  getMinuteDiff,
  getPrettyTime,
  getFullPrettyDate,
} from "../../lib/timing";
import { useNow } from "../../state/useNow";
import { MetricGrid, MetricPill } from "../PageLayout";
import MealSummary from "./MealSummary";

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
    <div className={`app-session-summary ${className}`.trim()}>
      {/* Child MealSummary if meal exists */}
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        {showMealSummary && session.meal ? (
          <MealSummary
            meal={session.meal}
            mealName={template.name}
            template={template}
          />
        ) : (
          <>
            <div>
              <div className="app-kicker mb-1">Overview</div>
              <h2 className="h5 mb-0 fw-bold">
                {template?.name || "Active Session"}
              </h2>
            </div>
            <span className="badge bg-secondary-subtle text-secondary-emphasis fs-6 fw-normal px-3 py-1 rounded-pill">
              {session.completed ? "Completed" : elapsedFormatted}
            </span>
          </>
        )}
      </div>

      {/* Primary Metrics: Start Time, Start BG, Length */}
      <div className="mb-3">
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Timing & Baseline
        </div>
        <MetricGrid>
          <MetricPill
            label="Start Time"
            value={getPrettyTime(session.timestamp)}
          />
          <MetricPill
            label="Start BG"
            value={
              session.initialGlucose
                ? `${session.initialGlucose} mg/dL`
                : currentBG
                  ? `${currentBG} mg/dL`
                  : "—"
            }
          />
          <MetricPill label="Length" value={durationFormatted} />
          <MetricPill
            label="Date"
            value={
              <span className="small">
                {getFullPrettyDate(session.timestamp)}
              </span>
            }
          />
        </MetricGrid>
      </div>

      {/* Treatment Totals & Last Doses */}
      <div className="mb-3">
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Dosing & Rescue Totals
        </div>
        <MetricGrid>
          <MetricPill
            label="Total Insulin"
            value={`${formatDose(session.insulin)}u`}
          />
          <MetricPill
            label="Total Glucose"
            value={
              session.glucose > 0
                ? `${session.glucose.toFixed(1)}g (${session.glucoseDoses})`
                : "0g"
            }
          />
          <MetricPill
            label="Last Insulin"
            value={
              lastInsulin ? (
                <div className="lh-sm">
                  <div>{formatDose(lastInsulin.value)}u</div>
                  <div className="small text-muted fw-normal">
                    {lastInsulin.timeAgo}
                  </div>
                </div>
              ) : (
                <span className="text-muted fw-normal">None</span>
              )
            }
          />
          <MetricPill
            label="Last Glucose"
            value={
              lastGlucose ? (
                <div className="lh-sm">
                  <div>{lastGlucose.value}g</div>
                  <div className="small text-muted fw-normal">
                    {lastGlucose.timeAgo}
                  </div>
                </div>
              ) : (
                <span className="text-muted fw-normal">None</span>
              )
            }
          />
        </MetricGrid>
      </div>

      {/* Treatment Windows */}
      {session.windows.length > 0 && (
        <div className="mb-3">
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            Treatment History ({session.windows.length})
          </div>
          <div className="d-flex flex-column gap-2">
            {session.windows.map((window, i) => {
              const windowInsulin = session.insulins[i];
              return (
                <div
                  key={i}
                  className="rounded-3 border p-2 bg-body-tertiary small"
                >
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-semibold">Window {i + 1}</span>
                    <span className="text-muted">
                      {window.initialBG} → {window.finalBG} mg/dL
                    </span>
                  </div>
                  {windowInsulin && (
                    <div className="d-flex justify-content-between mb-1">
                      <span>
                        {windowInsulin.value.toFixed(1)}u{" "}
                        {windowInsulin.variant.name}
                      </span>
                      <span className="text-muted">
                        {getFormattedTime(
                          Math.abs(
                            session.getRelativeN(windowInsulin.timestamp) * 60,
                          ),
                        )}{" "}
                        {session.getRelativeN(windowInsulin.timestamp) >= 0
                          ? "after"
                          : "before"}{" "}
                        meal
                      </span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between text-muted">
                    <span>
                      Duration:{" "}
                      {getFormattedTime(Math.round(window.length * 60))}
                    </span>
                    {window.glucoses.length > 0 && (
                      <span className="text-warning-emphasis fw-semibold">
                        +{window.glucoses.reduce((s, g) => s + g.value, 0)}g
                        rescue
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activities */}
      {session.activities.length > 0 && (
        <div className="mb-3">
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            Activities
          </div>
          <div className="d-flex flex-column gap-1">
            {session.activities.map((a, i) => (
              <div
                key={i}
                className="d-flex justify-content-between align-items-center py-1 small"
              >
                <span>{a.name}</span>
                <span className="fw-semibold">
                  {getFormattedTime(a.length)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flags & Notes */}
      {(template?.isFirstTime || session.isInvalid || session.notes) && (
        <div className="mb-3">
          {template?.isFirstTime && (
            <div className="small text-warning-emphasis mb-1">
              <i className="bi bi-info-circle me-1" />
              First time using this template
            </div>
          )}
          {session.isInvalid && (
            <div className="small text-danger-emphasis mb-1">
              <i className="bi bi-exclamation-triangle me-1" />
              Session is currently invalid
            </div>
          )}
          {session.notes && (
            <div className="small text-muted fst-italic">{session.notes}</div>
          )}
        </div>
      )}
    </div>
  );

  return content;
};

export default SessionSummary;
