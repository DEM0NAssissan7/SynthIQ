import { Fragment, useMemo } from "react";
import { getFormattedTime, getMinuteDiff, getPrettyTime } from "../lib/timing";
import { round } from "../lib/util";
import type Meal from "../models/events/meal";
import type Session from "../models/session";
import type MealTemplate from "../models/mealTemplate";
import TemplateMealSummary from "./TemplateMealSummary";
import { PreferencesStore } from "../storage/preferencesStore";

interface TemplateSummaryProps {
  template: MealTemplate;
  session: Session;
  meal?: Meal;
  currentBG?: number;
}
export default function TemplateSummary({
  template,
  session,
  meal,
  currentBG,
}: TemplateSummaryProps) {
  const bloodSugar = useMemo(
    () =>
      currentBG
        ? currentBG
        : session.initialGlucose
        ? session.initialGlucose
        : PreferencesStore.targetBG.value,
    [currentBG, session]
  );

  function getMinutesAgo(timestamp: Date) {
    return getMinuteDiff(new Date(), timestamp);
  }

  return (
    <>
      <h2 style={{ paddingTop: "12px" }}>{template.name}</h2>
      {template.isFirstTime && "This is the first time using this template\n"}
      {session.started && (
        <>
          Starting blood sugar: {bloodSugar}mg/dL
          <br />
          Session started at {getPrettyTime(session.timestamp)}
          <br />
        </>
      )}
      {session.insulin > 0 && (
        <>
          <br />
          <b>{session.insulin}u</b> insulin; last dose{" "}
          <b>
            {getFormattedTime(getMinutesAgo(session.latestInsulinTimestamp))}{" "}
            ago
          </b>{" "}
          ({getPrettyTime(session.latestInsulinTimestamp)})
        </>
      )}
      {session.glucose > 0 && (
        <>
          <br />
          <br />
          <b>{session.glucose} caps/grams</b> dextrose; last dose{" "}
          <b>
            {getFormattedTime(getMinutesAgo(session.latestGlucoseTimestamp))}{" "}
            ago
          </b>
        </>
      )}
      {session.activities.length > 0 && (
        <>
          <hr />
          <h5>Activities</h5>
          <br />
          {session.activities.map((a, i) => {
            return (
              <Fragment key={i}>
                <b>{a.name}</b> [{getPrettyTime(a.timestamp)}]:{" "}
                {getFormattedTime(a.length)} | {a.initialBG}mg/dL {"->"}{" "}
                {a.finalBG}mg/dL
              </Fragment>
            );
          })}
        </>
      )}
      {meal && (
        <TemplateMealSummary
          template={template}
          meal={meal}
          currentBG={bloodSugar}
        />
      )}
      {session.meals.length > 0 && (
        <>
          <hr />
          First meal eaten at {getPrettyTime(session.firstMealTimestamp)},{" "}
          {getFormattedTime(getMinutesAgo(session.firstMealTimestamp))} ago
          <br />
          <br />
          <b>{round(session.carbs, 0)}g</b> carbs
          <br />
          <b>{round(session.protein, 0)}g</b> protein
          <br />
          {round(session.fat, 0)}g fat (approx)
          <br />
          {round(session.calories, 0)} calories (approx)
        </>
      )}
    </>
  );
}
