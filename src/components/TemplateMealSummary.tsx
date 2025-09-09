import { useMemo, useState } from "react";
import { getInsulin, getCorrectionInsulin } from "../lib/metabolism";
import { insulinDosingRecommendation } from "../lib/templateHelpers";
import { round } from "../lib/util";
import type Meal from "../models/events/meal";
import type MealTemplate from "../models/mealTemplate";
import { Button } from "react-bootstrap";
import Insulin from "../models/events/insulin";
import React from "react";
import { getFullPrettyDate, getPrettyTime } from "../lib/timing";
import { CalibrationStore } from "../storage/calibrationStore";
import { PreferencesStore } from "../storage/preferencesStore";

function getFactorDesc(num: number, unit: string, type: string) {
  if (round(num, 1) === 0) return "";
  return (
    <>
      <b>
        {num > 0 && "+"}
        {round(num, 1)}
        {unit}
      </b>{" "}
      {type}
      <br />
    </>
  );
}
interface TemplateMealSummaryProps {
  template: MealTemplate;
  meal: Meal;
  currentBG: number;
}
export default function TemplateMealSummary({
  template,
  meal,
  currentBG,
}: TemplateMealSummaryProps) {
  const adjustments = insulinDosingRecommendation(template.sessions);
  const now = new Date();
  const session = template.getClosestSession(meal.carbs, meal.protein, now);
  console.log(session);
  const insulinCorrection = useMemo(
    () => getCorrectionInsulin(currentBG),
    [currentBG]
  );
  const insulinAdjustment = session ? session.insulinAdjustment : 0;
  const insulinOffset = session
    ? template.getMealInsulinOffset(
        session.carbs,
        session.protein,
        meal.carbs,
        meal.protein
      )
    : 0;
  const profileInsulin = getInsulin(meal.carbs, meal.protein);
  const insulins = (() => {
    const vectorizedInsulin = template.vectorizeInsulin(
      meal.carbs,
      meal.protein,
      now
    );
    // Fall back to profile
    if (!vectorizedInsulin || template.isFirstTime)
      return [new Insulin(profileInsulin, new Date())];
    return vectorizedInsulin;
  })();

  const overshootInsulinOffset = (() =>
    Math.max(
      (Math.min(currentBG - PreferencesStore.targetBG.value, 0) +
        PreferencesStore.overshootOffset.value) /
        CalibrationStore.insulinEffect.value,
      0
    ))();

  const scalingOffset = (() => {
    if (!session) return 0;
    let totalInsulin = 0;
    insulins.forEach((insulin) => (totalInsulin += insulin.value));
    return (
      totalInsulin -
      totalInsulin *
        (CalibrationStore.insulinEffect.value / session.insulinEffect)
    );
  })();

  const isSingleBolus = insulins.length < 2;

  const finalTiming = round(
    template.insulinTiming + adjustments.timingAdjustment,
    0
  );
  function getTiming(index: number) {
    if (!session) return 0;
    if (insulins.length < 2) return finalTiming;
    const insulin = insulins[index];
    return round(session.getN(insulin.timestamp) * 60, 0);
  }

  const [showExtra, setShowExtra] = useState(false);
  function toggleShowExtra() {
    setShowExtra(!showExtra);
  }

  return (
    <>
      <hr />
      <b>{round(meal.carbs, 0)}g</b> carbs
      <br />
      <b>{round(meal.protein, 0)}g</b> protein
      <br />
      <br />
      {insulins.map((insulin: Insulin, i: number) => (
        <React.Fragment key={i}>
          {isSingleBolus ? `Take ` : `Shot ${i + 1}: `}
          <b>
            {round(
              insulin.value +
                (i === 0 ? insulinCorrection : 0) +
                overshootInsulinOffset / insulins.length, // We add just a bit more insulin to overshoot our target and scale it by the number of insulins
              1
            )}
            u
          </b>{" "}
          insulin{" "}
          {!template.isFirstTime && (
            <>
              <b>{Math.abs(getTiming(i))} mins</b>{" "}
              {getTiming(i) > 0 ? "after" : "before"} you start eating
              <br />
              <br />
            </>
          )}
        </React.Fragment>
      ))}
      <hr />
      {getFactorDesc(insulinCorrection, "u", "correction")}
      {getFactorDesc(insulinOffset, "u", "offset")}
      {getFactorDesc(insulinAdjustment, " u", "adjustment")}
      {isSingleBolus &&
        getFactorDesc(adjustments.timingAdjustment, " min", "adjustment")}
      {PreferencesStore.scaleByISF.value &&
        getFactorDesc(scalingOffset, " u", "ISF scale")}
      {getFactorDesc(overshootInsulinOffset, " u", "overcompensation")}
      <br />
      <Button
        onClick={toggleShowExtra}
        variant="secondary"
        size="sm"
        style={{ width: "100%" }}
      >
        {showExtra ? "Hide Extra Info" : "Show Extra Info"}
      </Button>
      <br />
      {showExtra && (
        <>
          <hr />
          <b>Profile:</b> This meal requires{" "}
          <b>{round(profileInsulin + insulinCorrection, 1)}u</b> insulin
          {!template.isFirstTime && session && (
            <>
              <hr />
              <b>Base Session</b> <i>{getFullPrettyDate(session.timestamp)}</i>
              <br />
              {round(session.carbs, 0)}g carbs, {round(session.protein, 0)}g
              protein
              <br />
              <i>
                {session.initialGlucose}mg/dL {"->"} {session.finalBG}mg/dL
              </i>{" "}
              <br />
              <i>{session.glucose} grams/caps</i> glucose
              <br />
              {session.insulins.map(
                (insulin) =>
                  `${round(insulin.value, 1)}u ${round(
                    Math.abs(session.getN(insulin.timestamp)) * 60,
                    1
                  )} min ${
                    session.getN(insulin.timestamp) > 0 ? "after" : "before"
                  } eating\n`
              )}
            </>
          )}
          <hr />
          <b>{round(meal.fat, 0)}g</b> fat (approx)
          <br />
          <b>{round(meal.calories, 0)} kcal</b> (approx)
          <br />
        </>
      )}
    </>
  );
}
