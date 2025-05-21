import { Button, Form, ListGroup } from "react-bootstrap";
import AddedFoodsDisplay from "../components/AddedFoodsDisplay";
import FoodSearchDisplay from "../components/FoodSearchDisplay";
import { useWizardMealState } from "../state/useWizardMeal";
import MealGraph from "../components/MealGraph";
import { useEffect, useMemo } from "react";
import { getHourDiff, getPrettyTimeDiff, round } from "../lib/util";
import WizardManager from "../lib/wizardManager";
import { WizardState } from "../models/wizardState";
import { useNavigate } from "react-router";
import BloodSugarInput from "../components/BloodSugarInput";
import {
  getCorrectionInsulin,
  getInsulin,
  getOptimalInsulinTiming,
} from "../lib/metabolism";
import Unit from "../models/unit";
import NutritionOffset from "../components/NutritionOffset";
import useInsulinPrediction from "../state/useInsulinPrediction";

export default function WizardMealPage() {
  const {
    meal,
    addedFoods,
    removeFood,
    changeFoodAmount,
    carbs,
    protein,
    extraCarbs,
    setExtraCarbs,
    extraProtein,
    setExtraProtein,
    initialGlucose,
    setInitialGlucose,
  } = useWizardMealState();

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
    WizardManager.markMeal();
    WizardManager.moveToPage(WizardState.Insulin, navigate);
  }

  // Upon Startup
  useEffect(() => {
    if (!WizardManager.getMealMarked()) meal.timestamp = new Date();
  });

  return (
    <>
      <h1 className="mb-3">Meal Creation</h1>
      <div className="card mb-4">
        <div className="card-body">
          <FoodSearchDisplay />
        </div>
      </div>
      <div className="card mb-4">
        <div className="card-body">
          <AddedFoodsDisplay
            foods={addedFoods}
            removeFood={removeFood}
            changeFoodAmount={changeFoodAmount}
          />
        </div>
      </div>
      <div className="card mb-4">
        <div className="card-body">
          <Form.Label>Additional Nutrition</Form.Label>
          <ListGroup>
            <ListGroup.Item>
              <NutritionOffset
                label="Carbs"
                value={extraCarbs}
                setValue={setExtraCarbs}
                iconClassName="bi bi-cookie"
              />
              <NutritionOffset
                label="Protein"
                value={extraProtein}
                setValue={setExtraProtein}
                iconClassName="bi bi-egg-fried"
              />
            </ListGroup.Item>
          </ListGroup>
        </div>
      </div>
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
            <ListGroup.Item>
              <BloodSugarInput
                initialGlucose={initialGlucose}
                setInitialGlucose={setInitialGlucose}
              />
            </ListGroup.Item>
          </ListGroup>
        </div>
      </div>
      <div className="card mb-4">
        <div className="card-body">
          <Form.Label>Predicted Blood Sugar</Form.Label>
          <MealGraph meal={meal} from={-1} until={16} width="100%"></MealGraph>
        </div>
      </div>
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
