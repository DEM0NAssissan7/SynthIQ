import { Button, Form, ListGroup } from "react-bootstrap";
import { useEffect, useMemo, useState, type BaseSyntheticEvent } from "react";
import { round } from "../../lib/util";
import WizardManager from "../../lib/wizardManager";
import { WizardState } from "../../models/types/wizardState";
import { useNavigate } from "react-router";
import BloodSugarInput from "../../components/BloodSugarInput";
import Unit from "../../models/unit";
import useInsulinPrediction from "../../state/useInsulinPrediction";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import SessionPredictedSugarGraphCard from "../../components/SessionPredictedSugarGraphCard";
import { useWizardMeal } from "../../state/useMeal";
import { getHourDiff, getPrettyTimeDiff } from "../../lib/timing";
import { useWizardSession } from "../../state/useSession";
import Card from "../../components/Card";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import useInsulinSplitPrediction from "../../state/useInsulinSplitPrediction";
import { profile } from "../../storage/metaProfileStore";

export default function WizardMealPage() {
  const session = useWizardSession();
  const meal = useWizardMeal();

  // Predictions
  const { insulin, insulinTimestamp, insulinCorrection } = useInsulinPrediction(
    session,
    meal.carbs,
    meal.protein,
    session.initialGlucose,
    true
  );

  const [splitBolus, setSplitBolus] = useState(false);
  const {
    firstInsulinUnits,
    firstInsulinTime,
    secondInsulinUnits,
    secondInsulinTime,
  } = useInsulinSplitPrediction(
    session,
    meal.carbs,
    meal.protein,
    session.initialGlucose,
    true,
    splitBolus
  );
  function switchBolusType(e: BaseSyntheticEvent) {
    setSplitBolus(e.target.checked);
  }

  // Continue Buttons
  const [initialGlucose, setInitialGlucose] = useState(profile.target);
  const takeInsulinFirst = useMemo(() => {
    return getHourDiff(new Date(), insulinTimestamp) >= 0;
  }, [meal.carbs, meal.protein, session.initialGlucose]);

  const navigate = useNavigate();
  function takeInsulin() {
    WizardManager.moveToPage(WizardState.Insulin, navigate);
  }
  function beginEating() {
    if (confirm("Are you ready to start eating?")) {
      WizardManager.markMeal();
      WizardManager.setInitialGlucose(initialGlucose);
      WizardManager.moveToPage(WizardState.Insulin, navigate);
    }
  }
  function goToSelect() {
    navigate("/template/select");
  }

  // Upon Startup
  useEffect(() => {
    // We intentionally assign the timestamp directly so that we do not trigger notify()
    if (!WizardManager.getMealMarked()) meal._timestamp = new Date();
  });

  // We add the meal to the testmeals upon change
  useEffect(() => {
    session.clearTests();
    session.addTestMeal(meal);
  }, []);

  return (
    <>
      <h1 className="mb-3">Meal Creation</h1>

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
            {round(meal.carbs, 2)}g carbs<br></br>
            {round(meal.protein, 2)}g protein<br></br>
            <b>{round(insulin, 2)}u insulin</b>{" "}
            {(meal.carbs !== 0 || meal.protein !== 0) && (
              <>({round(insulinCorrection, 2)}u correction)</>
            )}
          </ListGroup.Item>
          {insulin > 0 && (
            <ListGroup.Item>
              <Form>
                <Form.Check // prettier-ignore
                  type="switch"
                  label="Dual Bolus"
                  onChange={switchBolusType}
                />
              </Form>
              {splitBolus ? (
                <>
                  <b>{round(firstInsulinUnits, 2)}u</b> of insulin{" "}
                  <b>
                    {getPrettyTimeDiff(
                      firstInsulinTime,
                      new Date(),
                      Unit.Time.Minute
                    )}
                  </b>{" "}
                  you start eating <br />
                  <b>{round(secondInsulinUnits, 2)}u</b> of insulin{" "}
                  <b>
                    {getPrettyTimeDiff(
                      secondInsulinTime,
                      new Date(),
                      Unit.Time.Minute
                    )}
                  </b>{" "}
                  you start eating <br />
                </>
              ) : (
                <>
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
                </>
              )}
            </ListGroup.Item>
          )}
          {!WizardManager.getMealMarked() && (
            <ListGroup.Item>
              <BloodSugarInput
                initialGlucose={session.initialGlucose}
                setInitialGlucose={(g) => setInitialGlucose(g)}
              />
            </ListGroup.Item>
          )}
        </ListGroup>
      </Card>

      <SessionPredictedSugarGraphCard session={session} />

      {!WizardManager.isActive() && (
        <Button variant="secondary" onClick={goToSelect} className="me-2">
          Go Back
        </Button>
      )}
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
