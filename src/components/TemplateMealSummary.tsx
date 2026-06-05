import { useMemo } from "react";
import {
  getCorrectionInsulin,
  getOvercompensationInsulins,
} from "../lib/metabolism";
import { insulinDosingRecommendation } from "../lib/templateHelpers";
import { round } from "../lib/util";
import type Meal from "../models/events/meal";
import type MealTemplate from "../models/mealTemplate";
import Insulin from "../models/events/insulin";
import { getFormattedTime, getFullPrettyDate } from "../lib/timing";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { useNow } from "../state/useNow";
import { PrivateStore } from "../storage/privateStore";
import { BasalStore } from "../storage/basalStore";

export default function TemplateMealSummary({
  template,
  meal,
  currentBG,
}: TemplateMealSummaryProps) {
  const now = useNow();
  const session = template.getBaseSession(meal);
  const defaultVariant = InsulinVariantManager.getDefault();
  const liverOutput = BasalStore.estimatedLiverOutput.value;
  if (PrivateStore.debugLogs.value) console.log(session);
  const insulinCorrection = useMemo(
    () => getCorrectionInsulin(currentBG, defaultVariant),
    [currentBG],
  );
  const adjustments = insulinDosingRecommendation(session ? [session] : []);

  const insulinAdjustment = session ? session.insulinAdjustment : 0;
  const insulinOffset = session
    ? template.getMealInsulinOffset(session, meal)
    : 0;
  const profileCarbInsulin = template.getProfileInsulin(
    meal.carbs,
    0,
    defaultVariant,
  );
  const profileProteinInsulin = template.getProfileInsulin(
    0,
    meal.protein,
    defaultVariant,
  );
  const profileInsulin = profileCarbInsulin + profileProteinInsulin;
  const insulins = (() => {
    const vectorizedInsulin = template.vectorizeInsulin(meal, session);
    if (!vectorizedInsulin || template.isFirstTime)
      return [
        new Insulin(profileInsulin, now, InsulinVariantManager.getDefault()),
      ];
    return vectorizedInsulin;
  })();

  const overcompensationInsulins = getOvercompensationInsulins(
    currentBG,
    insulins.map((i) => i.variant),
  );
  const overshootInsulinOffset = overcompensationInsulins.reduce(
    (total, v) => total + v,
    0,
  );

  const isSingleBolus = insulins.length < 2;

  function getFactorDesc(num: number, unit: string, type: string) {
    if (round(num, 1) === 0) return null;
    return (
      <div className="d-flex justify-content-between py-1 small">
        <span className="text-muted">{type}</span>
        <span className="fw-semibold">
          {num > 0 && "+"}
          {round(num, 1)}
          {unit}
        </span>
      </div>
    );
  }

  return (
    <>
          {session && (
            <div className="d-flex justify-content-between py-1 small">
              <span className="text-muted">Base meal insulin</span>
              <span className="fw-semibold">{session.mealInsulin.toFixed(1)}u</span>
            </div>
          )}
          {getFactorDesc(insulinCorrection, "u", "Correction")}
          {getFactorDesc(insulinOffset, "u", "Offset")}
          {getFactorDesc(insulinAdjustment, "u", "Adjustment")}
          {getFactorDesc(overshootInsulinOffset, "u", "Overcompensation")}
          {isSingleBolus &&
            getFactorDesc(adjustments.timingAdjustment, "min", "Timing adjustment")}

          {/* Dosing profile */}
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            Dosing profile
          </div>
          <div className="d-flex justify-content-between py-1 small">
            <span className="text-muted">Total recommended</span>
            <span className="fw-semibold">
              {round(profileInsulin + insulinCorrection, 1)}u
            </span>
          </div>
          <div className="d-flex justify-content-between py-1 small">
            <span className="text-muted">Carbs portion</span>
            <span className="fw-semibold">{profileCarbInsulin.toFixed(1)}u</span>
          </div>
          <div className="d-flex justify-content-between py-1 small">
            <span className="text-muted">Protein portion</span>
            <span className="fw-semibold">{profileProteinInsulin.toFixed(1)}u</span>
          </div>

          {/* Base session */}
          {!template.isFirstTime && session && (
            <>
              <hr className="my-2" />
              <div className="small text-uppercase text-muted fw-semibold mb-2">
                Reference session
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Session date</span>
                <span className="fw-semibold">{getFullPrettyDate(session.timestamp)}</span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Macros</span>
                <span className="fw-semibold">
                  {round(session.carbs, 0)}g carbs, {round(session.protein, 0)}g protein
                </span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Blood sugar</span>
                <span className="fw-semibold">
                  {session.initialGlucose}mg/dL → {session.finalBG}mg/dL
                </span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Peak / Min</span>
                <span className="fw-semibold">
                  {session.peakGlucose}mg/dL / {session.minGlucose}mg/dL
                </span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Score</span>
                <span className="fw-semibold">{session.score.toFixed(0)}</span>
              </div>
              {session.fastingVelocity && liverOutput && (
                <div className="d-flex justify-content-between py-1 small">
                  <span className="text-muted">Sensitivity</span>
                  <span className="fw-semibold">
                    {session.getSensitivityIndex(liverOutput)?.toFixed(0)} mg/dL per unit
                  </span>
                </div>
              )}
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Low corrections</span>
                <span className="fw-semibold">{session.glucose}g total</span>
              </div>

              {/* Treatment windows */}
              <hr className="my-2" />
              <div className="small text-uppercase text-muted fw-semibold mb-2">
                Treatment windows
              </div>
              {session.windows.map((window, i) => {
                const windowInsulin = session.insulins[i];
                return (
                  <div key={i} className="rounded-3 border p-2 mb-2 bg-body-tertiary small">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="fw-semibold">Window {i + 1}</span>
                      <span className="text-muted">
                        {window.initialBG}mg/dL → {window.finalBG}mg/dL
                      </span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span>
                        {windowInsulin.value.toFixed(1)}u {windowInsulin.variant.name}
                      </span>
                      <span className="text-muted">
                        {getFormattedTime(Math.abs(session.getRelativeN(windowInsulin.timestamp) * 60))}{" "}
                        {session.getRelativeN(windowInsulin.timestamp) > 0 ? "after" : "before"} meal
                      </span>
                    </div>
                    <div className="text-muted">
                      Absorbed: {window.insulins.map((ins, _i) => (
                        <span key={_i}>
                          {ins.value.toFixed(1)}u {ins.variant.name}
                          {_i < window.insulins.length - 1 ? ", " : ""}
                        </span>
                      ))}
                      {window.glucoses.length > 0 && (
                        <span className="ms-2">
                          ({window.glucoses.reduce((s, g) => s + g.value, 0)}g corrections)
                        </span>
                      )}
                    </div>
                    <div className="text-muted">
                      {getFormattedTime(Math.round(window.length * 60))} duration
                    </div>
                  </div>
                );
              })}
            </>
          )}
    </>
  );
}

interface TemplateMealSummaryProps {
  template: MealTemplate;
  meal: Meal;
  currentBG: number;
}
