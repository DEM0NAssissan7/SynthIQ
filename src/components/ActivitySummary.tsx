import { useMemo } from "react";
import { getFormattedTime, getMinuteDiff, getPrettyTime } from "../lib/timing";
import { useNow } from "../state/useNow";
import { roundByHalf } from "../lib/util";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { RescueVariantManager } from "../managers/rescueVariantManager";
import { getGlucoseCorrectionCaps } from "../lib/metabolism";
import MdIcon from "./md3/MdIcon";
import type { ActivitySession } from "../models/types/activitySession";
import type { Template } from "../models/types/interfaces";
import { ActivityManager } from "../managers/activityManager";
import { EntryStore } from "../storage/entryStore";

interface ActivitySummaryProps {
  activity: ActivitySession;
  template: Template;
  currentBG: number | null;
  className?: string;
}

export default function ActivitySummary({
  activity,
  template,
  currentBG,
  className = "",
}: ActivitySummaryProps) {
  const now = useNow(60);
  const defaultVariant = InsulinVariantManager.getDefault();
  const defaultRescueVariant = RescueVariantManager.getDefault();

  const baseCorrection = useMemo(
    () =>
      currentBG
        ? getGlucoseCorrectionCaps(currentBG, defaultRescueVariant, true)
        : 0,
    [currentBG, defaultRescueVariant],
  );
  const name = activity.name;
  const changeRate = ActivityManager.getChangeRate(name);
  const length = ActivityManager.getLength(name);
  const isFirstTime = ActivityManager.isFirstTime(name);

  const [isStarted] = EntryStore.activityIsActive.useState();

  const glucoseCorrectionRate = useMemo(
    () => -changeRate / defaultRescueVariant.effect,
    [template, defaultRescueVariant],
  );

  const totalGlucoseCorrection = useMemo(
    () => glucoseCorrectionRate * (length / 60) + baseCorrection,
    [glucoseCorrectionRate, template, baseCorrection],
  );

  const insulinCorrectionRate = useMemo(
    () => changeRate / defaultVariant.effect,
    [template, defaultVariant],
  );

  const insulinCorrectionTotal = useMemo(
    () => insulinCorrectionRate * (length / 60),
    [insulinCorrectionRate, template],
  );

  return (
    <div className={`app-discrete-summary ${className}`.trim()}>
      {/* Header */}
      <div className="app-discrete-header">
        <div>
          <h2 className="app-discrete-title">
            <MdIcon name="directions_walk" className="text-primary" size={20} />
            <span>{template.name}</span>
          </h2>
          <div className="app-discrete-subtitle">
            {isStarted ? (
              <>
                Started {getPrettyTime(activity.timestamp)} ·{" "}
                {getFormattedTime(getMinuteDiff(now, activity.timestamp))} ago
              </>
            ) : isFirstTime ? (
              <span className="fst-italic">First time using this template</span>
            ) : (
              <>
                Typical duration:{" "}
                <span className="fw-medium text-body">
                  {getFormattedTime(Math.round(length))}
                </span>
              </>
            )}
          </div>
        </div>
        <span
          className={`badge ${
            isStarted
              ? "bg-success-subtle text-success"
              : "bg-secondary-subtle text-secondary-emphasis"
          } fw-semibold px-2 py-0.5 rounded-pill`}
          style={{ fontSize: "0.72rem" }}
        >
          {isStarted ? "In Progress" : "Template"}
        </span>
      </div>

      {/* Discrete Stats Strip */}
      <div className="app-stat-strip">
        <div className="app-stat-strip-item">
          <span className="stat-label">Duration</span>
          <span className="stat-value">
            {getFormattedTime(Math.round(length))}
          </span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Impact Rate</span>
          <span className="stat-value">
            {changeRate > 0 ? "+" : ""}
            {changeRate.toFixed(0)} mg/dL/hr
          </span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Hourly Dose</span>
          <span className="stat-value">
            {changeRate < 0
              ? `${roundByHalf(glucoseCorrectionRate, true)} ${defaultRescueVariant.name}`
              : `${roundByHalf(insulinCorrectionRate, false)}u ${defaultVariant.name}`}
          </span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Total Projected</span>
          <span className="stat-value">
            {changeRate < 0
              ? `${roundByHalf(totalGlucoseCorrection, true)} ${defaultRescueVariant.name}`
              : `${roundByHalf(insulinCorrectionTotal, false)}u ${defaultVariant.name}`}
          </span>
        </div>
      </div>

      {/* Active Tracking Status (if started) */}
      {isStarted && (
        <div className="app-dosing-banner">
          <span className="dosing-label">Rescue Doses</span>
          <span className="dosing-value">
            {activity.glucose} doses
            {activity.latestRescueTimestamp && (
              <span className="dosing-note">
                (Last:{" "}
                {getFormattedTime(
                  getMinuteDiff(now, activity.latestRescueTimestamp),
                )}{" "}
                ago)
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
