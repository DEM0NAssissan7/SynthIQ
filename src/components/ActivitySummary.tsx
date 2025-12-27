import { useMemo } from "react";
import { getFormattedTime, getMinuteDiff, getPrettyTime } from "../lib/timing";
import type { ActivityTemplate } from "../models/activityTemplate";
import type Activity from "../models/events/activity";
import { useNow } from "../state/useNow";
import { roundByHalf } from "../lib/util";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { RescueVariantManager } from "../managers/rescueVariantManager";
import { getGlucoseCorrectionCaps } from "../lib/metabolism";

interface ActivitySummaryProps {
  activity: Activity;
  template: ActivityTemplate;
  currentBG: number | null;
}
export default function ActivitySummary({
  activity,
  template,
  currentBG,
}: ActivitySummaryProps) {
  const now = useNow();
  const defaultVariant = InsulinVariantManager.getDefault();
  const defaultRescueVariant = RescueVariantManager.getDefault();
  const baseCorrection = useMemo(
    () =>
      currentBG
        ? getGlucoseCorrectionCaps(currentBG, defaultRescueVariant, true)
        : 0,
    [currentBG]
  );
  const glucoseCorrectionRate = useMemo(
    () => -template.changeRate / defaultRescueVariant.effect,
    [template]
  );
  const totalGlucoseCorrection = useMemo(
    () => glucoseCorrectionRate * (template.length / 60) + baseCorrection,
    [glucoseCorrectionRate, template, baseCorrection]
  );
  const insulinCorrectionRate = useMemo(
    () => template.changeRate / defaultVariant.effect,
    [template, defaultVariant]
  );
  const insulinCorrectionTotal = useMemo(
    () => insulinCorrectionRate * (template.length / 60),
    [insulinCorrectionRate, template]
  );
  return (
    <>
      <h2 style={{ paddingTop: "12px" }}>{template.name}</h2>
      {template.isFirstTime ? (
        <>
          This is the first time using this template
          <br />
        </>
      ) : (
        <>
          Typical Length: <b>{getFormattedTime(Math.round(template.length))}</b>
          <br />
          Score:{" "}
          <b>
            {template.changeRate > 0 && "+"}
            {template.changeRate.toFixed()}mg/dL per hour
          </b>
          <hr />
          {template.changeRate < 0 ? (
            <>
              Consider taking{" "}
              <b>
                {roundByHalf(glucoseCorrectionRate, true)}{" "}
                {defaultRescueVariant.name}
              </b>{" "}
              every hour.
              <br /> You might need to take{" "}
              {roundByHalf(totalGlucoseCorrection, true)}{" "}
              {defaultRescueVariant.name} in total.{" "}
              {roundByHalf(baseCorrection, false) !== 0 && (
                <>
                  <br />
                  {baseCorrection >= 0 && "+"}
                  {roundByHalf(baseCorrection, false)}{" "}
                  {defaultRescueVariant.name} to correct for BG of {currentBG}
                  mg/dL
                </>
              )}
            </>
          ) : (
            <>
              Consider taking{" "}
              <b>
                {roundByHalf(insulinCorrectionRate, false)}u of{" "}
                {defaultVariant.name}
              </b>{" "}
              for every hour you plan to do this activity.
              <br />
              Typically{" "}
              <b>
                {roundByHalf(insulinCorrectionTotal, false)}u{" of "}
                {defaultVariant.name}
              </b>{" "}
              in total for this activity.
            </>
          )}
        </>
      )}
      <hr />
      {activity.started && (
        <>
          This activity was started at{" "}
          <b>{getPrettyTime(activity.timestamp)}</b>,{" "}
          <b>{getFormattedTime(getMinuteDiff(now, activity.timestamp))} ago</b>
          <br />
          <br />
          <b>{activity.glucose} doses</b>,{" "}
          {getFormattedTime(getMinuteDiff(now, activity.latestRescueTimestamp))}{" "}
          ago
        </>
      )}
    </>
  );
}
