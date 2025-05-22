/** This is the meal page that appears if you take insulin before eating */

import { Button, ListGroup } from "react-bootstrap";
import {
  getEpochMinutes,
  getPrettyTime,
  getTimestampFromOffset,
  round,
} from "../../lib/util";
import WizardManager from "../../lib/wizardManager";
import { WizardState } from "../../models/wizardState";
import { useNavigate } from "react-router";
import useInsulinPrediction from "../../state/useInsulinPrediction";
import { useEffect, useMemo } from "react";
import MealPredictedSugarGraphCard from "../../components/MealPredictedSugarGraphCard";
import MealAddedFoodsListCard from "../../components/MealAddedFoodsListCard";
import MealAdditionalNutrientsCard from "../../components/MealAdditionalNutrientsCard";
import MealSearchCard from "../../components/MealSearchCard";
import useVersion from "../../state/useVersion";
import { useWizardMeal } from "../../state/useMeal";

export default function WizardMealConfirmPage() {
  // Use the meal state
  const meal = useWizardMeal();

  // Make a state that updates once per minute to update the views
  const version = useVersion(1);

  // Predictions
  const { insulinTimestamp: optimalInsulinTimestamp } = useInsulinPrediction(
    meal,
    meal.carbs,
    meal.protein,
    meal.initialGlucose,
    false // Don't modify the meal
  );

  // Continue Buttons
  const navigate = useNavigate();
  function beginEating() {
    if (confirm("Are you ready to start eating?")) {
      WizardManager.markMeal();
      WizardManager.moveToPage(WizardState.Summary, navigate);
    }
  }

  const optimalMealTiming = useMemo(() => {
    return (
      getEpochMinutes(new Date()) - getEpochMinutes(optimalInsulinTimestamp)
    );
  }, [optimalInsulinTimestamp, version]);
  const optimalMealTimestamp = useMemo(() => {
    return getTimestampFromOffset(new Date(), optimalMealTiming / 60);
  }, [optimalMealTiming]);

  useEffect(() => {
    if (!WizardManager.getMealMarked()) meal._timestamp = new Date();
  });

  return (
    <>
      <h1 className="mb-3">Meal Confirmation</h1>

      <MealSearchCard meal={meal} />

      <MealAddedFoodsListCard meal={meal} />

      <MealAdditionalNutrientsCard meal={meal} />

      <div className="card mb-4">
        <div className="card-body">
          <ListGroup>
            <ListGroup.Item>
              {round(meal.carbs, 2)}g carbs<br></br>
              {round(meal.protein, 2)}g protein<br></br>
              <b>{round(meal.insulin, 2)}u insulin</b>
            </ListGroup.Item>
            {optimalMealTiming > 0 && (
              <ListGroup.Item>
                Consider eating in {optimalMealTiming} minutes.
                {optimalMealTiming >= 30 && (
                  <> ({getPrettyTime(optimalMealTimestamp)})</>
                )}
              </ListGroup.Item>
            )}
          </ListGroup>
        </div>
      </div>
      <MealPredictedSugarGraphCard meal={meal} />
      <div className="d-flex justify-content-end">
        <Button variant="primary" onClick={beginEating}>
          Begin Eating
        </Button>
      </div>
    </>
  );
}
