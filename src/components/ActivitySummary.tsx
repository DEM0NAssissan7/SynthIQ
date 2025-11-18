import { useMemo } from "react";
import { getFormattedTime, getMinuteDiff, getPrettyTime } from "../lib/timing";
import type { ActivityTemplate } from "../models/activityTemplate";
import type Activity from "../models/events/activity";
import { useNow } from "../state/useNow";
import { roundByHalf } from "../lib/util";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { RescueVariantManager } from "../managers/rescueVariantManager";

interface ActivitySummaryProps {
  activity: Activity;
  template: ActivityTemplate;
}
export default function ActivitySummary({
  activity,
  template,
}: ActivitySummaryProps) {
  const now = useNow();
  const defaultVariant = InsulinVariantManager.getDefault();
  const defaultRescueVariant = RescueVariantManager.getDefault();
  const glucoseCorrectionRate = useMemo(
    () => -template.score / defaultRescueVariant.effect,
    [template]
  );
  const totalGlucoseCorrection = useMemo(
    () => glucoseCorrectionRate * (template.length / 60),
    [glucoseCorrectionRate, template]
  );
  const insulinCorrectionRate = useMemo(
    () => template.score / defaultVariant.effect,
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
            {template.score > 0 && "+"}
            {template.score.toFixed()}mg/dL per hour
          </b>
          <hr />
          {template.score < 0 ? (
            <>
              Consider taking{" "}
              <b>
                {roundByHalf(glucoseCorrectionRate, true)}{" "}
                {defaultRescueVariant.name}
              </b>{" "}
              every hour.
              <br /> You might need to take{" "}
              {roundByHalf(totalGlucoseCorrection, true)}{" "}
              {defaultRescueVariant.name} in total.
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
