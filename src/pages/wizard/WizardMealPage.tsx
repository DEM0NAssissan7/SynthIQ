import { Button, Form, ListGroup } from "react-bootstrap";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import BloodSugarInput from "../../components/BloodSugarInput";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import Card from "../../components/Card";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import WizardManager from "../../lib/wizardManager";
import TemplateSummary from "../../components/TemplateSummary";
import { WizardStore } from "../../storage/wizardStore";
import { WizardPage } from "../../models/types/wizardState";
import { PreferencesStore } from "../../storage/preferencesStore";

export default function WizardMealPage() {
  const [template] = WizardStore.template.useState();
  const [session] = WizardStore.session.useState();
  const [meal] = WizardStore.meal.useState();

  const [initialGlucose, setInitialGlucose] = useState<number | null>(null); // We are not wanting to modify the actual targetbg, so we do not use the store state
  const navigate = useNavigate();
  function goBack() {
    WizardManager.moveToPage(WizardPage.Hub, navigate);
  }
  function goToSelect() {
    WizardManager.moveToPage(WizardPage.Select, navigate);
  }
  function beginEating() {
    if (!initialGlucose && !session.insulinMarked) {
      alert(`You must input your current blood sugar`);
      return;
    }
    if (confirm("Are you ready to start eating?")) {
      WizardManager.markMeal();
      if (initialGlucose) WizardManager.setInitialGlucose(initialGlucose);
      WizardManager.moveToPage(
        session.insulinMarked ? WizardPage.Hub : WizardPage.Insulin,
        navigate
      );
    }
  }
  function markInsulin() {
    WizardManager.moveToPage(WizardPage.Insulin, navigate);
  }

  // Upon Startup
  useEffect(() => {
    // We intentionally assign the timestamp directly so that we do not trigger notify()
    meal._timestamp = new Date();
  }, [meal]);

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
            <TemplateSummary
              template={template}
              session={session}
              meal={meal}
              currentBG={
                session.initialGlucose
                  ? undefined
                  : initialGlucose || PreferencesStore.targetBG.value
              }
            />
          </ListGroup.Item>
          {!session.started && (
            <ListGroup.Item>
              <BloodSugarInput
                initialGlucose={initialGlucose}
                setInitialGlucose={(g) => setInitialGlucose(g)}
              />
            </ListGroup.Item>
          )}
        </ListGroup>
      </Card>
      <div className="d-flex justify-content-between align-items-center mt-3">
        {!session.started && (
          <Button onClick={goToSelect} variant="secondary">
            Go Back
          </Button>
        )}
        {session.insulinMarked ? (
          <Button onClick={goBack} variant="secondary">
            Go To Hub
          </Button>
        ) : (
          <Button variant="primary" onClick={markInsulin}>
            Mark Insulin
          </Button>
        )}

        <Button variant="primary" onClick={beginEating}>
          Begin Eating
        </Button>
      </div>
    </>
  );
}
