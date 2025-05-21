import { Button, ListGroup } from "react-bootstrap";
import { useWizardMealState } from "../state/useWizardMeal";
import { useEffect, useMemo } from "react";
import { getHourDiff, getPrettyTimeDiff, round } from "../lib/util";
import WizardManager from "../lib/wizardManager";
import { WizardState } from "../models/wizardState";
import { useNavigate } from "react-router";
import BloodSugarInput from "../components/BloodSugarInput";
import Unit from "../models/unit";
import useInsulinPrediction from "../state/useInsulinPrediction";
import MealSearchCard from "../components/MealSearchCard";
import MealAddedFoodsListCard from "../components/MealAddedFoodsListCard";
import MealAdditionalNutrientsCard from "../components/MealAdditionalNutrientsCard";
import MealPredictedSugarGraphCard from "../components/MealPredictedSugarGraphCard";

export default function WizardMealPage() {
  const { meal, carbs, protein, initialGlucose, setInitialGlucose } =
    useWizardMealState();

  // Predictions
  const { insulin, insulinTimestamp, insulinCorrection } = useInsulinPrediction(
    meal,
    carbs,
    protein,
    initialGlucose,
    true
  );

  // Continue Buttons
  const takeInsulinFirst = useMemo(() => {
    return getHourDiff(insulinTimestamp, new Date()) >= 0;
  }, [carbs, protein, initialGlucose]);

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
    if (!WizardManager.getMealMarked()) meal.timestamp = new Date();
  });

  return (
    <>
      <h1 className="mb-3">Meal Creation</h1>

      <MealSearchCard />

      <MealAddedFoodsListCard />

      <MealAdditionalNutrientsCard />

      <div className="card mb-4">
        <div className="card-body">
          <ListGroup>
            <ListGroup.Item>
              {round(carbs, 2)}g carbs<br></br>
              {round(protein, 2)}g protein<br></br>
              <b>{round(insulin, 2)}u insulin</b>{" "}
              {(carbs !== 0 || protein !== 0) && (
                <>({round(insulinCorrection, 2)}u correction)</>
              )}
            </ListGroup.Item>
            {insulin > 0 && (
              <ListGroup.Item>
                Consider taking <b>{round(insulin, 2)}u</b> of insulin
                {(carbs !== 0 || protein !== 0) && (
                  <>
                    {" "}
                    <b>
                      {getPrettyTimeDiff(
                        new Date(),
                        insulinTimestamp,
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
                initialGlucose={initialGlucose}
                setInitialGlucose={setInitialGlucose}
              />
            </ListGroup.Item>
          </ListGroup>
        </div>
      </div>

      <MealPredictedSugarGraphCard />

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
