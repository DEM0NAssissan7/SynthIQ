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
import FoodSearchCard from "../../components/FoodSearchCard";
import useVersion from "../../state/useVersion";
import { useWizardMeal } from "../../state/useMeal";
import {
  getMinuteDiff,
  getPrettyTime,
  getTimestampFromOffset,
} from "../../lib/timing";
import { useWizardEvent } from "../../state/useEvent";
import Card from "../../components/Card";

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

  // Cancel
  function cancelEvent() {
    if (
      confirm(
        "Are you sure you want to cancel the entire event? This will discard all data you've inputted so far for this event."
      )
    ) {
      WizardManager.resetWizard(navigate);
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

  // We add the meal to the testmeals upon startup
  useEffect(() => {
    event.clearTests();
    event.addTestMeal(meal);
  }, []);

  return (
    <>
      <h1 className="mb-3">Meal Confirmation</h1>

      <FoodSearchCard meal={meal} />

      <MealAddedFoodsListCard meal={meal} />

      <MealAdditionalNutrientsCard meal={meal} />

      <Card>
        <ListGroup>
          <ListGroup.Item>
            {round(meal.carbs, 2)}g carbs
            <br />
            {round(meal.protein, 2)}g protein
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
      </Card>
      <EventPredictedSugarGraphCard event={event} />
      <div className="d-flex justify-content-end">
        <div className="w-100 d-flex justify-content-between">
          <Button variant="danger" onClick={cancelEvent}>
            Cancel Event
          </Button>
          <Button variant="primary" onClick={beginEating}>
            Begin Eating
          </Button>
        </div>
      </div>
    </>
  );
}
