import { getMinuteDiff, getPrettyTime } from "../lib/timing";
import { round } from "../lib/util";
import type Session from "../models/session";
import { getCorrectionInsulin } from "../lib/metabolism";
import type Template from "../models/template";

interface SessionSummaryProps {
  session: Session;
  template: Template;
}

export default function TemplateSessionSummary({
  session,
  template,
}: SessionSummaryProps) {
  function getCorrection() {
    return getCorrectionInsulin(session.initialGlucose);
  }
  // Helpers
  function getMinutesAgo(timestamp: Date) {
    return getMinuteDiff(new Date(), timestamp);
  }
  function getHoursAgo(timestamp: Date) {
    return round(getMinutesAgo(timestamp) / 60, 1);
  }

  return (
    <>
      <h2>{template.name}</h2>
      Initial blood sugar: {round(session.initialGlucose, 2)}mg/dL
      <br />
      Session started at {getPrettyTime(session.timestamp)} (
      {getHoursAgo(session.timestamp)} hours ago)
      {(session.carbs !== 0 || session.protein !== 0) && (
        <>
          <hr />
          Meal eaten at {getPrettyTime(session.latestMealTimestamp)}
          <br />
          {round(session.carbs, 0)}g carbs
          <br />
          {round(session.protein, 0)}g protein
          <br />
          {!template.isFirstTime && (
            <>
              <br />
              <i>
                Based on the template, this meal takes{" "}
                {round(template.insulin + getCorrection(), 2)}u insulin (
                {round(getCorrection(), 2)}u correction)
              </i>
              <br />
            </>
          )}
        </>
      )}
      {session.insulin !== 0 && (
        <>
          <hr />
          <b>{round(session.insulin, 2)}u insulin taken</b> (last dose at{" "}
          {getPrettyTime(session.latestInsulinTimestamp)},{" "}
          {getHoursAgo(session.latestInsulinTimestamp)} hours ago)
          <br />
        </>
      )}
      {session.glucose !== 0 && (
        <>
          <hr />
          <b>{round(session.glucose, 2)} caps of glucose</b> (last dose at{" "}
          {getPrettyTime(session.latestGlucoseTimestamp)},{" "}
          {getMinutesAgo(session.latestGlucoseTimestamp)} minutes ago)
          <br />
        </>
      )}
    </>
  );
}
