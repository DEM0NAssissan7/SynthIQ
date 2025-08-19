import { useMemo, useState } from "react";
import { getInsulin, getCorrectionInsulin } from "../lib/metabolism";
import { insulinDosingRecommendation } from "../lib/templateHelpers";
import { round } from "../lib/util";
import type Meal from "../models/events/meal";
import type MealTemplate from "../models/mealTemplate";
import { Button } from "react-bootstrap";
import Insulin from "../models/events/insulin";
import React from "react";

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
  const session = template.getClosestSession(meal.carbs, meal.protein);
  const insulinCorrection = useMemo(
    () => getCorrectionInsulin(currentBG),
    [currentBG]
  );
  const insulinAdjustment = session ? session.insulinErrorCorrection : 0;
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
      meal.protein
    );
    // Fall back to profile
    if (!vectorizedInsulin || template.isFirstTime)
      return [new Insulin(profileInsulin, new Date())];
    return vectorizedInsulin;
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
            {round(insulin.value + (i === 0 ? insulinCorrection : 0), 1)}u
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
          {!template.isFirstTime && (
            <>
              <br />
              <b>Previous session</b>: {round(template.previousInsulin, 1)}u
              insulin {round(template.insulinTiming, 0)} min{" "}
              {template.insulinTiming > 0 ? "after" : "before"} eating began
            </>
          )}
          <br />
          <br />
          <b>{round(meal.fat, 0)}g</b> fat (approx)
          <br />
          <b>{round(meal.calories, 0)} kcal</b> (approx)
        </>
      )}
    </>
  );
}
