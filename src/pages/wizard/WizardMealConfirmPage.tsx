/** This is the meal page that appears if you take insulin before eating */

import { Button, Form, ListGroup } from "react-bootstrap";
import { round } from "../../lib/util";
import WizardManager from "../../lib/wizardManager";
import { WizardState } from "../../models/types/wizardState";
import { useNavigate } from "react-router";
import useInsulinPrediction from "../../state/useInsulinPrediction";
import { useEffect, useMemo } from "react";
import SessionPredictedSugarGraphCard from "../../components/SessionPredictedSugarGraphCard";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import useVersion from "../../state/useVersion";
import { useWizardMeal } from "../../state/useMeal";
import {
  getMinuteDiff,
  getPrettyTime,
  getTimestampFromOffset,
} from "../../lib/timing";
import { useWizardSession } from "../../state/useSession";
import Card from "../../components/Card";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";

export default function WizardMealConfirmPage() {
  // Use the meal state
  const session = useWizardSession();
  const meal = useWizardMeal();

  // Make a state that updates once per minute to update the views
  const version = useVersion(1);

  // Predictions
  const {
    insulinTimestamp: optimalInsulinTimestamp,
    insulin: insulinRequirement,
  } = useInsulinPrediction(
    session,
    meal.carbs,
    meal.protein,
    session.initialGlucose,
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
  function cancelSession() {
    WizardManager.cancelSession(navigate);
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
    session.clearTests();
    session.addTestMeal(meal);
  }, []);

  return (
    <>
      <h1 className="mb-3">Meal Confirmation</h1>

      <Card>
        <FoodSearchDisplay meal={meal} />
      </Card>

      <Card>
        <AddedFoodsDisplay meal={meal} />
      </Card>

      <Card>
        <Form.Label>Additional Nutrition</Form.Label>
        <MealAdditionalNutrients meal={meal} />
      </Card>

      <Card>
        <ListGroup>
          <ListGroup.Item>
            {round(meal.carbs, 2)}g carbs
            <br />
            {round(meal.protein, 2)}g protein
            <br />
            <b>{round(session.insulin, 2)}u insulin taken</b>
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
      <SessionPredictedSugarGraphCard session={session} />
      <div className="d-flex justify-content-end">
        <div className="w-100 d-flex justify-content-between">
          <Button variant="danger" onClick={cancelSession}>
            Cancel Session
          </Button>
          <Button variant="primary" onClick={beginEating}>
            Begin Eating
          </Button>
        </div>
      </div>
    </>
  );
}
