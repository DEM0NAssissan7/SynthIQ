/** This is the meal page that appears if you take insulin before eating */

import { Button, ListGroup } from "react-bootstrap";
import { round } from "../../lib/util";
import WizardManager from "../../lib/wizardManager";
import { WizardState } from "../../models/wizardState";
import { useNavigate } from "react-router";
import useInsulinPrediction from "../../state/useInsulinPrediction";
import { useEffect, useMemo } from "react";
import EventPredictedSugarGraphCard from "../../components/EventPredictedSugarGraphCard";
import MealAddedFoodsListCard from "../../components/MealAddedFoodsListCard";
import MealAdditionalNutrientsCard from "../../components/MealAdditionalNutrientsCard";
import MealSearchCard from "../../components/MealSearchCard";
import useVersion from "../../state/useVersion";
import { useWizardMeal } from "../../state/useMeal";
import {
  getMinuteDiff,
  getPrettyTime,
  getTimestampFromOffset,
} from "../../lib/timing";
import { useWizardEvent } from "../../state/useEvent";

export default function WizardMealConfirmPage() {
  // Use the meal state
  const event = useWizardEvent();
  const meal = useWizardMeal();

  // Make a state that updates once per minute to update the views
  const version = useVersion(1);

  // Predictions
  const {
    insulinTimestamp: optimalInsulinTimestamp,
    insulin: insulinRequirement,
  } = useInsulinPrediction(
    event,
    meal.carbs,
    meal.protein,
    event.initialGlucose,
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
    return getMinuteDiff(new Date(), optimalInsulinTimestamp);
  }, [optimalInsulinTimestamp, version]);

  const optimalMealTimestamp = useMemo(() => {
    return getTimestampFromOffset(new Date(), optimalMealTiming / 60);
  }, [optimalMealTiming]);

  useEffect(() => {
    if (!WizardManager.getMealMarked()) meal.timestamp = new Date();
  });

  // We add the meal to the testmeals upon change
  useEffect(() => {
    event.clearTestMeals();
    event.addTestMeal(meal);
    console.log(meal.carbs, event);
  }, [meal]);

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
              {round(event.carbs, 2)}g carbs
              <br />
              {round(event.protein, 2)}g protein
              <br />
              <b>{round(event.insulin, 2)}u insulin taken</b>
              <br />
              <i>This meal requires {round(insulinRequirement, 2)}u insulin</i>
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
      <EventPredictedSugarGraphCard event={event} />
      <div className="d-flex justify-content-end">
        <Button variant="primary" onClick={beginEating}>
          Begin Eating
        </Button>
      </div>
    </>
  );
}
