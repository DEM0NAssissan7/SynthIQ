import React, { useMemo } from "react";
import type Meal from "../../models/events/meal";
import type MealTemplate from "../../models/mealTemplate";
import { round, roundByHalf } from "../../lib/util";
import { CalibrationStore } from "../../storage/calibrationStore";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
import { MetricGrid, MetricPill } from "../PageLayout";
import Insulin from "../../models/events/insulin";
import { useNow } from "../../state/useNow";
import { getFullPrettyDate } from "../../lib/timing";
import Card from "../Card";

export interface MealSummaryProps {
  meal: Meal;
  mealName: string;
  template: MealTemplate;
  contained?: boolean;
  className?: string;
}

function formatDose(value: number) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export const MealSummary: React.FC<MealSummaryProps> = ({
  meal,
  mealName,
  template,
  contained = false,
  className = "",
}) => {
  const now = useNow(60);
  const defaultVariant = InsulinVariantManager.getDefault();
  const displayName = mealName || template?.name || "Meal";
  const baseSession = template.getBaseSession(meal);

  // Calculate Profile Insulin (with template or direct from calibration store)
  const { profileInsulin, profileCarbInsulin, profileProteinInsulin } =
    useMemo(() => {
      if (template) {
        const carbsIns = template.getProfileInsulin(
          meal.carbs,
          0,
          defaultVariant,
        );
        const proteinIns = template.getProfileInsulin(
          0,
          meal.protein,
          defaultVariant,
        );
        return {
          profileInsulin: carbsIns + proteinIns,
          profileCarbInsulin: carbsIns,
          profileProteinInsulin: proteinIns,
        };
      }
      const carbsEffect = CalibrationStore.carbsEffect.value || 0;
      const proteinEffect = CalibrationStore.proteinEffect.value || 0;
      const variantEffect = defaultVariant?.effect || 1;
      const carbsIns = (meal.carbs * carbsEffect) / variantEffect;
      const proteinIns = (meal.protein * proteinEffect) / variantEffect;
      return {
        profileInsulin: carbsIns + proteinIns,
        profileCarbInsulin: carbsIns,
        profileProteinInsulin: proteinIns,
      };
    }, [template, meal.carbs, meal.protein, defaultVariant]);

  // Calculate Optimal Insulins
  const optimalInsulins: Insulin[] | null = useMemo(() => {
    if (template) {
      const vectorized = template.vectorizeInsulin(meal, baseSession);
      if (vectorized && vectorized.length > 0 && !template.isFirstTime) {
        return vectorized;
      }
    }
    return null;
  }, [template, meal, profileInsulin, now, defaultVariant]);

  const totalOptimalInsulin = useMemo(() => {
    return optimalInsulins?.reduce((acc, curr) => acc + curr.value, 0) ?? null;
  }, [optimalInsulins]);

  const content = (
    <div className={`app-meal-summary ${className}`.trim()}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <div className="app-kicker mb-1">Overview</div>
          <h2 className="h5 mb-0 fw-bold">{displayName}</h2>
          {baseSession ? (
            <div className="small text-muted mt-1">
              Base session:{" "}
              <span className="fw-semibold text-body">
                {getFullPrettyDate(baseSession.timestamp)}
              </span>
            </div>
          ) : (
            <div className="small text-muted mt-1 fst-italic">
              First time using template
            </div>
          )}
        </div>
        {meal.addedFoods.length > 0 && (
          <span className="badge bg-primary-subtle text-primary fw-semibold px-2 py-1 rounded-pill">
            {meal.addedFoods.length}{" "}
            {meal.addedFoods.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {/* Macronutrient Grid */}
      <div className="mb-3">
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Nutrition Breakdown
        </div>
        <MetricGrid>
          <MetricPill
            label="Net Carbs"
            value={
              meal.carbs !== meal.totalCarbs
                ? `${round(meal.carbs, 0)}g (${round(meal.totalCarbs, 0)}g)`
                : `${round(meal.carbs, 0)}g`
            }
          />
          <MetricPill label="Protein" value={`${round(meal.protein, 0)}g`} />
          <MetricPill label="Fat" value={`${round(meal.fat, 0)}g`} />
          <MetricPill
            label="Calories"
            value={`${round(meal.calories, 0)} kcal`}
          />
        </MetricGrid>
      </div>

      {/* Insulin Dosing Section */}
      <div>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Insulin Estimates
        </div>
        <MetricGrid>
          <MetricPill
            label="Profile Insulin"
            value={
              <div className="lh-sm">
                <div>{formatDose(profileInsulin)}u</div>
                <div className="small text-muted fw-normal">
                  {formatDose(profileCarbInsulin)}u carbs ·{" "}
                  {formatDose(profileProteinInsulin)}u protein
                </div>
              </div>
            }
          />
          {totalOptimalInsulin && (
            <MetricPill
              label="Optimal Total"
              value={`${formatDose(totalOptimalInsulin)}u`}
            />
          )}
        </MetricGrid>

        {/* Detailed Optimal Insulins Breakdown */}
        {optimalInsulins && optimalInsulins.length > 0 && (
          <div className="mt-2 d-flex flex-column gap-1">
            {optimalInsulins.map((ins, idx) => (
              <div
                key={idx}
                className="d-flex justify-content-between align-items-center py-1 px-2 rounded-3 bg-body-tertiary small"
              >
                <span className="text-muted">
                  Dose {optimalInsulins.length > 1 ? idx + 1 : ""} (
                  {ins.variant.name})
                </span>
                <span className="fw-semibold">{roundByHalf(ins.value)}u</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (contained) {
    return <Card className={className}>{content}</Card>;
  }

  return content;
};

export default MealSummary;
