import { useState, useEffect, useMemo } from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import BloodSugarInput from "../../components/BloodSugarInput";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import { PageLayout, PageActions } from "../../components/PageLayout";
import MealSummary from "../../components/summary/MealSummary";
import { useNow } from "../../state/useNow";
import { useStream } from "../../state/useStream";
import { EntryStore } from "../../storage/entryStore";
import { SessionManager } from "../../managers/sessionManager";
import { StreamManager } from "../../managers/streamManager";
import Meal from "../../models/events/meal";
import Card from "../../components/Card";
import MdIcon from "../../components/md3/MdIcon";

export default function MealPage() {
  const [meal] = EntryStore.meal.useState();
  const [, streamVersion] = useStream();
  // Only a meal that starts its own session can be pre-bolused
  const showPreBolus = useMemo(
    () => SessionManager.startsNewSession(),
    [streamVersion],
  );

  const [initialGlucose, setInitialGlucose] = useState<number | null>(null); // We are not wanting to modify the actual targetbg, so we do not use the store state
  const navigate = useNavigate();
  function selectDifferent() {
    // We have to reset the meal because it would happen anyways - don't want stale state
    EntryStore.meal.value = new Meal(new Date(), "");
    navigate("/selectmeal");
  }
  function beginEating() {
    if (!initialGlucose && showPreBolus) {
      alert(`You must input your current blood sugar`);
      return;
    }
    if (confirm("Are you ready to start eating?")) {
      const timestamp = new Date();
      if (initialGlucose) StreamManager.markReading(initialGlucose, timestamp);
      StreamManager.markMeal(
        meal.foods,
        timestamp,
        meal.name,
        meal.templateUUID,
        meal.isGarbage,
      );
      EntryStore.meal.value = new Meal(new Date(), ""); // The meal is logged: reset the draft
      navigate(
        SessionManager.getCurrentSession()?.insulinMarked
          ? "/hub"
          : "/markinsulin",
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
      <Card>
        <FoodSearchDisplay meal={meal} />
      </Card>

      <Card>
        <AddedFoodsDisplay meal={meal} />
      </Card>

      <Card>
        <div className="app-card-title">
          <MdIcon name="tune" className="text-primary" size={20} />
          <span>Additional Nutrition</span>
        </div>
        <MealAdditionalNutrients meal={meal} />
      </Card>

      <Card>
        <MealSummary
          meal={meal}
          mealName={meal.name}
          currentBG={initialGlucose}
        />
      </Card>

      {showPreBolus && (
        <Card>
          <BloodSugarInput
            initialGlucose={initialGlucose}
            setInitialGlucose={(g) => setInitialGlucose(g)}
            pullFromNightscout={true}
          />
        </Card>
      )}

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
