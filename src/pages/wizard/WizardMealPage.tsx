import { Button, Form, ListGroup } from "react-bootstrap";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import BloodSugarInput from "../../components/BloodSugarInput";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import Card from "../../components/Card";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import WizardManager from "../../managers/wizardManager";
import TemplateSummary from "../../components/TemplateSummary";
import { WizardStore } from "../../storage/wizardStore";
import { WizardPage } from "../../models/types/wizardPage";
import { PreferencesStore } from "../../storage/preferencesStore";
import { useNow } from "../../state/useNow";
import { getDailyBasal, getFastingVelocity } from "../../lib/basal";
import {
  PageActions,
  PageHeader,
  PageLayout,
} from "../../components/PageLayout";

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
    return;
  }
  function beginEating() {
    if (!initialGlucose && !session.insulinMarked) {
      alert(`You must input your current blood sugar`);
      return;
    }
    if (confirm("Are you ready to start eating?")) {
      WizardManager.markMeal();
      if (initialGlucose)
        WizardManager.setInitialGlucose(
          initialGlucose,
          getFastingVelocity(),
          getDailyBasal(),
        );
      WizardManager.moveToPage(
        session.insulinMarked ? WizardPage.Hub : WizardPage.Insulin,
        navigate,
      );
    }
  }
  function markInsulin() {
    WizardManager.moveToPage(WizardPage.Insulin, navigate);
  }

  // Upon Startup
  const now = useNow();
  useEffect(() => {
    // We intentionally assign the timestamp directly so that we do not trigger notify()
    meal._timestamp = now;
  }, [meal, now]);

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Wizard"
        title="Meal creation"
        subtitle="Build the meal cleanly, review the predicted session impact, and keep the next action obvious."
      />

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
      <PageActions>
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
      </PageActions>
    </PageLayout>
  );
}
