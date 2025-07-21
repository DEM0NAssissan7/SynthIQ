import { useMemo } from "react";
import { getCorrectionInsulin, getInsulin } from "../lib/metabolism";
import {
  getInsulinDose,
  insulinDosingRecommendation,
} from "../lib/templateHelpers";
import { round } from "../lib/util";
import type Meal from "../models/events/meal";
import type Session from "../models/session";
import type Template from "../models/template";
import SuggestionExplaination from "./SuggestionExplaination";
import TemplateManager from "../lib/templateManager";

interface TemplateStateSummaryProps {
  template: Template;
  session: Session;
  meal: Meal;
  currentGlucose?: number;
}

export default function TemplateStateSummary({
  template,
  session,
  meal,
  currentGlucose,
}: TemplateStateSummaryProps) {
  function getInsulinPrediction() {
    return getInsulin(meal.carbs, meal.protein);
  }
  const BG = useMemo(
    () => currentGlucose || session.initialGlucose,
    [currentGlucose, session]
  );

  const {
    amountSuggestion,
    timingSuggestion,
    amountAdjustment,
    timingAdjustment,
  } = insulinDosingRecommendation(template.sessions);

  console.log(
    "ELEMENT",
    amountSuggestion,
    timingSuggestion,
    template,
    TemplateManager.getTemplates()
  );
  function getTiming() {
    return template.insulinTiming;
  }
  function getMealInsulinOffset() {
    if (!template.isFirstTime) return template.getMealInsulinOffset(meal);
    return 0;
  }
  return (
    <>
      {template.isFirstTime && "General Profile: "} Take{" "}
      <b>
        {round(
          template.isFirstTime || session.insulin !== 0
            ? getInsulinPrediction() + getCorrectionInsulin(BG)
            : getInsulinDose(template, meal, BG),
          2
        )}
        u
      </b>{" "}
      insulin{" "}
      {(meal.carbs !== 0 || meal.protein !== 0) &&
        getCorrectionInsulin(BG) !== 0 &&
        `(${round(getCorrectionInsulin(BG), 2)}u correction) `}
      {getMealInsulinOffset() !== 0 &&
        session.insulin !== 0 &&
        `(${round(getMealInsulinOffset(), 2)}u offset)`}
      {!template.isFirstTime && session.insulin === 0 && (
        <>
          <b>
            {round(Math.abs(getTiming()), 0)} minutes{" "}
            {getTiming() > 0 ? "after" : "before"}
          </b>{" "}
          you start eating
          {session.insulin > 0 && (
            <>
              <br />
              {`You've already taken ${session.insulin}u insulin`}
            </>
          )}
          {(amountAdjustment !== 0 || timingAdjustment !== 0) && (
            <>
              <hr />
              {amountAdjustment !== 0 && `${amountAdjustment}u adjustment`}
              <br />
              {timingAdjustment !== 0 &&
                `${timingAdjustment} minutes adjustment`}
              <br />
              <SuggestionExplaination
                amountSuggestion={amountSuggestion}
                timingSuggestion={timingSuggestion}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
