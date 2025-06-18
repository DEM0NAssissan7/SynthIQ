import { getPrettyTime } from "../lib/timing";
import { round } from "../lib/util";
import type MetaEvent from "../models/event";
import { useMemo } from "react";
import { getCorrectionInsulin, getInsulin } from "../lib/metabolism";

interface EventSummaryProps {
  event: MetaEvent;
}

export default function EventSummary({ event }: EventSummaryProps) {
  // Predictions
  const insulinRequirement = useMemo(() => {
    return getInsulin(event.carbs, event.protein);
  }, [event]);

  return (
    <>
      Initial blood sugar: {round(event.initialGlucose, 2)}mg/dL (
      {round(getCorrectionInsulin(event.initialGlucose), 1)}u correction)
      {(event.carbs !== 0 || event.protein !== 0) && (
        <>
          <hr />
          Meal eaten at {getPrettyTime(event.latestMealTimestamp)}
          <br />
          {round(event.carbs, 2)}g carbs
          <br />
          {round(event.protein, 2)}g protein
          <br />
          <br />
          <i>This meal requires {round(insulinRequirement, 2)}u insulin</i>
          <br />
        </>
      )}
      {event.insulin !== 0 && (
        <>
          <hr />
          <b>{round(event.insulin, 2)}u insulin taken</b> (last dose at{" "}
          {getPrettyTime(event.latestInsulinTimestamp)})
          <br />
        </>
      )}
      {event.glucose !== 0 && (
        <>
          <hr />
          <b>{round(event.glucose, 2)}caps of glucose</b> (last dose at{" "}
          {getPrettyTime(event.latestGlucoseTimestamp)})
          <br />
        </>
      )}
    </>
  );
}
