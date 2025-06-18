import { useNavigate } from "react-router";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import Card from "../../components/Card";
import EventGraph from "../../components/EventGraph";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import GlucoseManager from "../../components/GlucoseManager";
import InsulinManager from "../../components/InsulinManager";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import WizardManager from "../../lib/wizardManager";
import { WizardState } from "../../models/wizardState";
import { useWizardEvent } from "../../state/useEvent";
import useMeal from "../../state/useMeal";
import { Button } from "react-bootstrap";
import EventSummary from "../../components/EventSummary";

export default function WizardEditPage() {
  const event = useWizardEvent();
  const meal = useMeal(event.latestMeal);

  const navigate = useNavigate();
  function finishEdit() {
    WizardManager.moveToPage(WizardState.Summary, navigate);
  }
  return (
    <>
      <h1>Edit Events</h1>
      <Card>
        <FoodSearchDisplay meal={meal} />
      </Card>

      <Card>
        <AddedFoodsDisplay meal={meal} />
      </Card>

      <Card>
        <MealAdditionalNutrients meal={meal} />
      </Card>

      <Card>
        <InsulinManager event={event} />
      </Card>

      <Card>
        <GlucoseManager event={event} />
      </Card>

      <Card>
        <EventSummary event={event} />
      </Card>

      <Card>
        <EventGraph event={event} from={-1} />
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={finishEdit}>
          Done
        </Button>
      </div>
    </>
  );
}
