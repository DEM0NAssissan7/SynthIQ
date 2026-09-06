import { useState, useEffect, useMemo } from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import BloodSugarInput from "../../components/BloodSugarInput";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import {
  PageLayout,
  PageActions,
  PageHeader,
} from "../../components/PageLayout";
import MealSummary from "../../components/summary/MealSummary";
import WizardManager from "../../managers/wizardManager";
import { useNow } from "../../state/useNow";
import { WizardStore } from "../../storage/wizardStore";
import Card from "../../components/Card";

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
  function selectDifferent() {
    // We have to reset the meal because it would happen anyways - don't want stale state
    WizardManager.resetMeal();
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
        eyebrow="Meal"
        title={template?.name || "Meal entry"}
        subtitle="Search and add foods, customize portions, and monitor nutritional totals."
      />

      <Card>
        <FoodSearchDisplay meal={meal} />
      </Card>

      <Card>
        <AddedFoodsDisplay meal={meal} />
      </Card>

      <Card>
        <div className="app-card-title">
          <i className="bi bi-sliders text-primary" />
          <span>Additional Nutrition</span>
        </div>
        <MealAdditionalNutrients meal={meal} />
      </Card>

      <Card>
        <MealSummary
          template={template}
          meal={meal}
          mealName={template.name}
        />
      </Card>

      <Card>
        <BloodSugarInput
          initialGlucose={initialGlucose}
          setInitialGlucose={(g) => setInitialGlucose(g)}
          pullFromNightscout={true}
        />
      </Card>

      <PageActions>
        {showPreBolus && (
          <Button variant="primary" onClick={markInsulin}>
            Mark Pre-Bolus
          </Button>
        )}
        <Button
          variant={showPreBolus ? "outline-primary" : "primary"}
          onClick={beginEating}
        >
          Begin Eating
        </Button>
        <Button variant="outline-danger" onClick={selectDifferent}>
          Select Different Meal
        </Button>
      </PageActions>
    </PageLayout>
  );
}
