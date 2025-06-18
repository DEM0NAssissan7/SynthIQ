import { Button, Form, ListGroup } from "react-bootstrap";
import { useEffect, useMemo } from "react";
import { round } from "../../lib/util";
import WizardManager from "../../lib/wizardManager";
import { WizardState } from "../../models/wizardState";
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
import NightscoutManager from "../../lib/nightscoutManager";
import CustomMealSearch from "../../components/CustomMealSearch";
import { setWizardMeal } from "../../storage/wizardStore";
import type Meal from "../../models/events/meal";

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

  // Continue Buttons
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
      WizardManager.moveToPage(WizardState.Insulin, navigate);
    }
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
    NightscoutManager.loadCustomMeals();
  }, []);

  return (
    <>
      <h1 className="mb-3">Meal Creation</h1>

      <Card>
        <CustomMealSearch
          onChange={(meal: Meal) => {
            setWizardMeal(meal);
            navigate(0);
          }}
          meal={meal}
        />
      </Card>

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
              initialGlucose={session.initialGlucose}
              setInitialGlucose={(g) => {
                if (!WizardManager.getMealMarked()) session.initialGlucose = g;
              }}
            />
          </ListGroup.Item>
        </ListGroup>
      </Card>

      <SessionPredictedSugarGraphCard session={session} />

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
