import { useMemo, useState } from "react";
import {
  getCorrectionInsulin,
  getOvercompensationInsulins,
} from "../lib/metabolism";
import { insulinDosingRecommendation } from "../lib/templateHelpers";
import { round, roundByHalf } from "../lib/util";
import type Meal from "../models/events/meal";
import type MealTemplate from "../models/mealTemplate";
import { Button } from "react-bootstrap";
import Insulin from "../models/events/insulin";
import React from "react";
import { getFormattedTime, getFullPrettyDate } from "../lib/timing";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { useNow } from "../state/useNow";
import { PrivateStore } from "../storage/privateStore";
import { getFastingVelocity } from "../lib/basal";

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
  fastingVelocity: number;
}
export default function TemplateMealSummary({
  template,
  meal,
  currentBG,
  fastingVelocity,
}: TemplateMealSummaryProps) {
  const now = useNow();
  const time = meal.timestamp ?? now;
  const session = template.getOptimalSession(
    meal.carbs,
    meal.protein,
    time,
    currentBG,
    fastingVelocity
  );
  const defaultVariant = InsulinVariantManager.getDefault();
  if (PrivateStore.debugLogs.value) console.log(session);
  const insulinCorrection = useMemo(
    () => getCorrectionInsulin(currentBG, defaultVariant),
    [currentBG]
  );
  const adjustments = insulinDosingRecommendation(session ? [session] : []);

  const insulinAdjustment = session ? session.insulinAdjustment : 0;
  const insulinOffset = session
    ? template.getMealInsulinOffset(session, meal.carbs, meal.protein)
    : 0;
  const profileCarbInsulin = template.getProfileInsulin(
    meal.carbs,
    0,
    defaultVariant
  );
  const profileProteinInsulin = template.getProfileInsulin(
    0,
    meal.protein,
    defaultVariant
  );
  const profileInsulin = profileCarbInsulin + profileProteinInsulin;
  const fastingAdjustmentInsulins = (() => {
    if (!session) return [];
    const windows = session.windows;
    const currentFastingVelocity = getFastingVelocity();
    return windows.map((w) => {
      const insulin = w.insulin;
      if (session.fastingVelocity === null) {
        insulin.value = 0;
        return insulin;
      }
      insulin.value = w.length * currentFastingVelocity;
      return insulin;
    });
  })();
  const fastingInsulinAdjustment = (() => {
    let i = 0;
    fastingAdjustmentInsulins.forEach((insulin) => (i += insulin.value));
    return i;
  })();
  const insulins = (() => {
    const vectorizedInsulin = template.vectorizeInsulin(
      meal.carbs,
      meal.protein,
      time,
      currentBG,
      fastingVelocity
    );
    // Fall back to profile
    if (!vectorizedInsulin || template.isFirstTime)
      return [
        new Insulin(profileInsulin, now, InsulinVariantManager.getDefault()),
      ];
    return vectorizedInsulin;
  })();

  const overcompensationInsulins = getOvercompensationInsulins(
    currentBG,
    insulins.map((i) => i.variant)
  );
  const overshootInsulinOffset: number = (() => {
    let total = 0;
    for (let insulin of overcompensationInsulins) {
      total += insulin;
    }
    return total;
  })();

  const isSingleBolus = insulins.length < 2;

  const finalTiming = round(
    (session ? session.getRelativeN(session.firstInsulinTimestamp) * 60 : 0) +
      adjustments.timingAdjustment,
    0
  );
  function getTiming(index: number) {
    if (!session) return 0;
    if (insulins.length < 2) return finalTiming;
    const insulin = insulins[index];
    return round(session.getRelativeN(insulin.timestamp) * 60, 0);
  }

  const [showExtra, setShowExtra] = useState(false);
  function toggleShowExtra() {
    setShowExtra(!showExtra);
  }

  return (
    <>
      <hr />
      <b>{round(meal.totalCarbs, 0)}g</b> carbs
      <br />
      {meal.totalCarbs !== meal.carbs && (
        <>
          <b>{round(meal.carbs, 0)}g</b> net carbs
          <br />
        </>
      )}
      <b>{round(meal.protein, 0)}g</b> protein
      <br />
      <br />
      {insulins.map((insulin: Insulin, i: number) => {
        const fastingAdjustment =
          fastingAdjustmentInsulins.length <= i
            ? 0
            : fastingAdjustmentInsulins[i].value;
        return (
          <React.Fragment key={i}>
            {isSingleBolus ? `Take ` : `Shot ${i + 1}: `}
            <b>
              {roundByHalf(
                insulin.value +
                  (i === 0 ? insulinCorrection : 0) +
                  overshootInsulinOffset / insulins.length + // We add just a bit more insulin to overshoot our target and scale it by the number of insulins
                  fastingAdjustment // Add our adjustment for this window
              )}
              u
            </b>{" "}
            of <i>{insulin.variant.name}</i>{" "}
            {!template.isFirstTime && (
              <>
                <b>{getFormattedTime(Math.abs(getTiming(i)))}</b>{" "}
                {getTiming(i) > 0 ? "after" : "before"} you start eating
                <br />
                <br />
              </>
            )}
          </React.Fragment>
        );
      })}
      <br />
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
          {" "}
          <hr />
          {session && (
            <>
              <b>{session.mealInsulin.toFixed(1)}u</b> base
              <br />
              <br />
            </>
          )}
          {getFactorDesc(insulinCorrection, "u", "correction")}
          {getFactorDesc(insulinOffset, "u", "offset")}
          {getFactorDesc(insulinAdjustment, " u", "adjustment")}
          {getFactorDesc(fastingInsulinAdjustment, "u", "fasting offset")}
          {getFactorDesc(overshootInsulinOffset, " u", "overcompensation")}
          {isSingleBolus &&
            getFactorDesc(adjustments.timingAdjustment, " min", "adjustment")}
          <hr />
          <b>Profile:</b> This meal requires{" "}
          <b>{round(profileInsulin + insulinCorrection, 1)}u</b> insulin (
          {profileCarbInsulin.toFixed(1)}u carbs,{" "}
          {profileProteinInsulin.toFixed(1)}u protein)
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
              {session.peakGlucose}mg/dL {"-"} {session.minGlucose}mg/dL
              <br />
              Score: <b>{session.score.toFixed(0)}</b>
              <br />
              <i>{session.glucose} low correction doses</i>
              <br />
              <br />
              {session.windows.map((window) => (
                <>
                  <b>{window.insulin.value.toFixed(1)}u</b>{" "}
                  {window.insulin.variant.name}{" "}
                  {getFormattedTime(
                    round(
                      Math.abs(session.getRelativeN(window.insulin.timestamp)) *
                        60,
                      1
                    )
                  )}{" "}
                  {session.getRelativeN(window.insulin.timestamp) > 0
                    ? "after"
                    : "before"}{" "}
                  eating{" "}
                  {`[${getFormattedTime(round(window.length * 60))}, ${
                    window.initialBG
                  }mg/dL -> ${window.finalBG}mg/dL]`}
                  <br />
                </>
              ))}
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
