/** This is the meal page that appears if you take insulin before eating */

import { Button, ListGroup } from "react-bootstrap";
import { useWizardMealState } from "./state/useWizardMeal";
import {
  getEpochMinutes,
  getPrettyTime,
  getTimestampFromOffset,
  round,
} from "./lib/util";
import WizardManager from "./lib/wizardManager";
import { WizardState } from "./models/wizardState";
import { useNavigate } from "react-router";
import useInsulinPrediction from "./state/useInsulinPrediction";
import { useEffect, useMemo } from "react";
import MealPredictedSugarGraphCard from "./components/MealPredictedSugarGraphCard";
import MealAddedFoodsListCard from "./components/MealAddedFoodsListCard";
import MealAdditionalNutrientsCard from "./components/MealAdditionalNutrientsCard";
import MealSearchCard from "./components/MealSearchCard";
import useVersion from "./state/useVersion";

export default function WizardMealConfirmPage() {
  const { meal, carbs, protein, insulin, initialGlucose } =
    useWizardMealState();

  // Make a state that updates once per minute to update the views
  const version = useVersion(1);

  // Predictions
  const { insulinTimestamp: optimalInsulinTimestamp } = useInsulinPrediction(
    meal,
    carbs,
    protein,
    initialGlucose,
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
    if (!WizardManager.getMealMarked()) meal.timestamp = new Date();
  });

  return (
    <>
      <h1 className="mb-3">Meal Confirmation</h1>

      <MealSearchCard />

      <MealAddedFoodsListCard />

      <MealAdditionalNutrientsCard />

      <div className="card mb-4">
        <div className="card-body">
          <ListGroup>
            <ListGroup.Item>
              {round(carbs, 2)}g carbs<br></br>
              {round(protein, 2)}g protein<br></br>
              <b>{round(insulin, 2)}u insulin</b>
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
      <MealPredictedSugarGraphCard />
      <div className="d-flex justify-content-end">
        <Button variant="primary" onClick={beginEating}>
          Begin Eating
        </Button>
      </div>
    </>
  );
}
