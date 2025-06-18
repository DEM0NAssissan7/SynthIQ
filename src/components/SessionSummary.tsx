import { getPrettyTime } from "../lib/timing";
import { round } from "../lib/util";
import type Session from "../models/session";
import { useMemo } from "react";
import { getCorrectionInsulin, getInsulin } from "../lib/metabolism";

interface SessionSummaryProps {
  session: Session;
}

export default function SessionSummary({ session }: SessionSummaryProps) {
  // Predictions
  const insulinRequirement = useMemo(() => {
    return getInsulin(session.carbs, session.protein);
  }, [session]);

  return (
    <>
      Initial blood sugar: {round(session.initialGlucose, 2)}mg/dL (
      {round(getCorrectionInsulin(session.initialGlucose), 1)}u correction)
      {(session.carbs !== 0 || session.protein !== 0) && (
        <>
          <hr />
          Meal eaten at {getPrettyTime(session.latestMealTimestamp)}
          <br />
          {round(session.carbs, 2)}g carbs
          <br />
          {round(session.protein, 2)}g protein
          <br />
          <br />
          <i>This meal requires {round(insulinRequirement, 2)}u insulin</i>
          <br />
        </>
      )}
      {session.insulin !== 0 && (
        <>
          <hr />
          <b>{round(session.insulin, 2)}u insulin taken</b> (last dose at{" "}
          {getPrettyTime(session.latestInsulinTimestamp)})
          <br />
        </>
      )}
      {session.glucose !== 0 && (
        <>
          <hr />
          <b>{round(session.glucose, 2)}caps of glucose</b> (last dose at{" "}
          {getPrettyTime(session.latestGlucoseTimestamp)})
          <br />
        </>
      )}
    </>
  );
}
