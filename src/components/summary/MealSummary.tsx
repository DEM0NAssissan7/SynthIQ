import React, { useMemo } from "react";
import type Meal from "../../models/events/meal";
import type MealTemplate from "../../models/mealTemplate";
import { round } from "../../lib/util";
import { CalibrationStore } from "../../storage/calibrationStore";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
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
  statusBadge?: React.ReactNode;
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
  statusBadge,
}) => {
  const now = useNow(60);
  const defaultVariant = InsulinVariantManager.getDefault();
  const displayName = mealName || template?.name || "Meal";
  const baseSession = template?.getBaseSession(meal);

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
    if (!template) return null;
    const vectorized = template.vectorizeInsulin(meal, baseSession);
    if (vectorized && vectorized.length > 0 && !template.isFirstTime) {
      return vectorized;
    }
    return null;
  }, [template, meal, profileInsulin, now, defaultVariant, baseSession]);

  const totalOptimalInsulin = useMemo(() => {
    return (
      optimalInsulins?.reduce((n, insulin) => n + insulin.value, 0) ?? null
    );
  }, [optimalInsulins]);

  const content = (
    <div className={`app-discrete-summary ${className}`.trim()}>
      {/* Header */}
      <div className="app-discrete-header">
        <div className="min-w-0">
          <div className="app-discrete-title">
            <span>{displayName}</span>
            {meal.addedFoods.length > 0 && (
              <span
                className="badge bg-primary-subtle text-primary fw-medium px-2 py-0.5 rounded-pill"
                style={{ fontSize: "0.7rem" }}
              >
                {meal.addedFoods.length}{" "}
                {meal.addedFoods.length === 1 ? "item" : "items"}
              </span>
            )}
          </div>
          {baseSession ? (
            <div className="app-discrete-subtitle">
              Base session:{" "}
              <span className="fw-medium text-body">
                {getFullPrettyDate(baseSession.timestamp)}
              </span>
            </div>
          ) : (
            <div className="app-discrete-subtitle fst-italic">
              First time using template
            </div>
          )}
        </div>
        {statusBadge && <div className="ms-2 flex-shrink-0">{statusBadge}</div>}
      </div>

      {/* Discrete Macro Strip */}
      <div className="app-stat-strip">
        <div className="app-stat-strip-item">
          <span className="stat-label">Carbs</span>
          <span className="stat-value">
            {round(meal.carbs, 0)}g
            {meal.carbs !== meal.totalCarbs && (
              <span className="stat-sub">({round(meal.totalCarbs, 0)}g)</span>
            )}
          </span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Protein</span>
          <span className="stat-value">{round(meal.protein, 0)}g</span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Fat</span>
          <span className="stat-value">{round(meal.fat, 0)}g</span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Calories</span>
          <span className="stat-value">{round(meal.calories, 0)} kcal</span>
        </div>
      </div>

      {/* Discrete Insulin Section */}
      {optimalInsulins && optimalInsulins.length > 0 ? (
        <div className="d-flex flex-column gap-1">
          <div className="d-flex justify-content-between align-items-center px-0.5">
            <span
              className="text-uppercase text-muted fw-bold"
              style={{ fontSize: "0.64rem", letterSpacing: "0.04em" }}
            >
              Optimal Doses
            </span>
            <span className="small fw-semibold">
              {totalOptimalInsulin
                ? `${formatDose(totalOptimalInsulin)}u total`
                : ""}
              <span
                className="text-muted fw-normal ms-1"
                style={{ fontSize: "0.72rem" }}
              >
                (Profile: {formatDose(profileInsulin)}u)
              </span>
            </span>
          </div>
          {optimalInsulins.map((ins, idx) => (
            <div key={idx} className="app-dose-item">
              <span className="dose-name">
                <i
                  className="bi bi-capsule-pill opacity-75"
                  style={{ fontSize: "0.75rem" }}
                />
                <span>
                  Dose {optimalInsulins.length > 1 ? idx + 1 : ""} (
                  {ins.variant.name})
                  {baseSession && (
                    <span className="opacity-75 ms-1">
                      · {baseSession.getRelativeN(ins.timestamp).toFixed(1)}hr
                    </span>
                  )}
                </span>
              </span>
              <span className="dose-value">{ins.value.toFixed(1)}u</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="app-dosing-banner">
          <span className="dosing-label">Profile Insulin</span>
          <span className="dosing-value">
            {formatDose(profileInsulin)}u
            <span className="dosing-note">
              ({formatDose(profileCarbInsulin)}u C ·{" "}
              {formatDose(profileProteinInsulin)}u P)
            </span>
          </span>
        </div>
      )}
    </div>
  );

  if (contained) {
    return <Card className={className}>{content}</Card>;
  }

  return content;
};

export default MealSummary;
