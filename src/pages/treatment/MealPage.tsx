import { useState, useEffect, useMemo } from "react";
import { Button, Card, Form, ListGroup } from "react-bootstrap";
import { useNavigate } from "react-router";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import BloodSugarInput from "../../components/BloodSugarInput";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import {
  PageLayout,
  PageHeader,
  PageActions,
} from "../../components/PageLayout";
import TemplateSummary from "../../components/summary/TemplateSummary";
import WizardManager from "../../managers/wizardManager";
import { useNow } from "../../state/useNow";
import { PreferencesStore } from "../../storage/preferencesStore";
import { WizardStore } from "../../storage/wizardStore";

export default function MealPage() {
  const [template] = WizardStore.template.useState();
  const [session] = WizardStore.session.useState();
  const [meal] = WizardStore.meal.useState();
  const showPreBolus = useMemo(
    () => WizardManager.shouldTransitionSession() || !session.started,
    [session],
  );

  const [initialGlucose, setInitialGlucose] = useState<number | null>(null); // We are not wanting to modify the actual targetbg, so we do not use the store state
  const navigate = useNavigate();
  function goBack() {
    navigate("/hub");
  }
  function selectDifferent() {
    navigate("/selectmeal");
  }
  function beginEating() {
    if (!initialGlucose) {
      alert(`You must input your current blood sugar`);
      return;
    }
    if (confirm("Are you ready to start eating?")) {
      WizardManager.markMeal(initialGlucose);
      navigate(
        WizardStore.session.value.insulinMarked ? "/hub" : "/markinsulin",
      );
    }
  }
  function markInsulin() {
    navigate(showPreBolus ? "/prebolus" : "/markinsulin");
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
          <ListGroup.Item>
            <BloodSugarInput
              initialGlucose={initialGlucose}
              setInitialGlucose={(g) => setInitialGlucose(g)}
            />
          </ListGroup.Item>
        </ListGroup>
      </Card>
      <PageActions>
        <Button variant="secondary" onClick={goBack}>
          Back to Hub
        </Button>
        <Button variant="danger" onClick={selectDifferent}>
          Select Different Meal
        </Button>
        {(session.mealMarked ||
          session.insulins.length === 0 ||
          !session.started) && (
          <Button variant="primary" onClick={markInsulin}>
            {showPreBolus ? `Mark Pre-Bolus` : `Mark Insulin`}
          </Button>
        )}
        <Button variant="primary" onClick={beginEating}>
          Begin Eating
        </Button>
      </PageActions>
    </PageLayout>
  );
}
