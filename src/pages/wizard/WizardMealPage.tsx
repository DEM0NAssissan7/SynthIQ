import { Button, ListGroup } from "react-bootstrap";
import { useEffect, useMemo } from "react";
import { round } from "../../lib/util";
import WizardManager from "../../lib/wizardManager";
import { WizardState } from "../../models/wizardState";
import { useNavigate } from "react-router";
import BloodSugarInput from "../../components/BloodSugarInput";
import Unit from "../../models/unit";
import useInsulinPrediction from "../../state/useInsulinPrediction";
import MealSearchCard from "../../components/MealSearchCard";
import MealAddedFoodsListCard from "../../components/MealAddedFoodsListCard";
import MealAdditionalNutrientsCard from "../../components/MealAdditionalNutrientsCard";
import MealPredictedSugarGraphCard from "../../components/MealPredictedSugarGraphCard";
import { useWizardMeal } from "../../state/useMeal";
import { getHourDiff, getPrettyTimeDiff } from "../../lib/timing";

export default function WizardMealPage() {
  const meal = useWizardMeal();

  // Predictions
  const { insulin, insulinTimestamp, insulinCorrection } = useInsulinPrediction(
    meal,
    meal.carbs,
    meal.protein,
    meal.initialGlucose,
    true
  );

  // Continue Buttons
  const takeInsulinFirst = useMemo(() => {
    return getHourDiff(new Date(), insulinTimestamp) >= 0;
  }, [meal.carbs, meal.protein, meal.initialGlucose]);

  const navigate = useNavigate();
  function takeInsulin() {
    WizardManager.moveToPage(WizardState.Insulin, navigate);
  }
  function beginEating() {
    if (confirm("Are you ready to start eating?")) {
      WizardManager.markMeal();
      WizardManager.moveToPage(WizardState.Insulin, navigate);
    }
  }

  // Upon Startup
  useEffect(() => {
    // We intentionally assign the timestamp directly so that we do not trigger notify()
    if (!WizardManager.getMealMarked()) meal._timestamp = new Date();
  });

  return (
    <>
      <h1 className="mb-3">Meal Creation</h1>

      <MealSearchCard meal={meal} />

      <MealAddedFoodsListCard meal={meal} />

      <MealAdditionalNutrientsCard meal={meal} />

      <div className="card mb-4">
        <div className="card-body">
          <ListGroup>
            <ListGroup.Item>
              {round(meal.carbs, 2)}g carbs<br></br>
              {round(meal.protein, 2)}g protein<br></br>
              <b>{round(insulin, 2)}u insulin</b>{" "}
              {(meal.carbs !== 0 || meal.protein !== 0) && (
                <>({round(insulinCorrection, 2)}u correction)</>
              )}
            </ListGroup.Item>
            {insulin > 0 && (
              <ListGroup.Item>
                Consider taking <b>{round(insulin, 2)}u</b> of insulin
                {(meal.carbs !== 0 || meal.protein !== 0) && (
                  <>
                    {" "}
                    <b>
                      {getPrettyTimeDiff(
                        insulinTimestamp,
                        new Date(),
                        Unit.Time.Minute
                      )}
                    </b>{" "}
                    you start eating
                  </>
                )}
              </ListGroup.Item>
            )}
            <ListGroup.Item>
              <BloodSugarInput
                initialGlucose={meal.initialGlucose}
                setInitialGlucose={(g) => {
                  if (!WizardManager.getMealMarked()) meal.initialGlucose = g;
                }}
              />
            </ListGroup.Item>
          </ListGroup>
        </div>
      </div>

      <MealPredictedSugarGraphCard meal={meal} />

      <div className="d-flex justify-content-end">
        <Button
          variant={takeInsulinFirst ? "primary" : "secondary"}
          onClick={takeInsulin}
          className="me-2"
        >
          Take Insulin
        </Button>
        <Button
          variant={takeInsulinFirst ? "secondary" : "primary"}
          onClick={beginEating}
        >
          Begin Eating
        </Button>
      </div>
    </>
  );
}
