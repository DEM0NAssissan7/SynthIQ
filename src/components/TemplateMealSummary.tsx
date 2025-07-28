import { useState } from "react";
import { getInsulin, getCorrectionInsulin } from "../lib/metabolism";
import { insulinDosingRecommendation } from "../lib/templateHelpers";
import { round } from "../lib/util";
import type Meal from "../models/events/meal";
import type Template from "../models/template";
import { Button } from "react-bootstrap";

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
  template: Template;
  meal: Meal;
  currentBG: number;
}
export default function TemplateMealSummary({
  template,
  meal,
  currentBG,
}: TemplateMealSummaryProps) {
  function adjustments() {
    return insulinDosingRecommendation(template.sessions);
  }

  function getFinalAmount() {
    return round(
      template.insulin +
        template.getMealInsulinOffset(meal) +
        getCorrectionInsulin(currentBG) +
        adjustments().amountAdjustment,
      1
    );
  }
  function getFinalTiming() {
    return template.insulinTiming + adjustments().timingAdjustment;
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
      Take <b>{getFinalAmount()}u</b> insulin{" "}
      {!template.isFirstTime && (
        <>
          <b>{Math.abs(round(getFinalTiming(), 0))} mins</b>{" "}
          {getFinalTiming() > 0 ? "after" : "before"} you start eating
        </>
      )}
      <hr />
      {getFactorDesc(getCorrectionInsulin(currentBG), "u", "correction")}
      {getFactorDesc(template.getMealInsulinOffset(meal), "u", "offset")}
      {getFactorDesc(adjustments().amountAdjustment, "u", "adjustment")}
      {getFactorDesc(adjustments().timingAdjustment, " min", "adjustment")}
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
          <b>
            {round(
              getInsulin(meal.carbs, meal.protein) +
                getCorrectionInsulin(currentBG),
              1
            )}
            u
          </b>{" "}
          insulin
          {!template.isFirstTime && (
            <>
              <br />
              <b>Previous session</b>: {round(template.insulin, 1)}u insulin{" "}
              {round(template.insulinTiming, 0)} min{" "}
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
