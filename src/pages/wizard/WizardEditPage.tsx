import { useNavigate } from "react-router";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import Card from "../../components/Card";
import SessionGraph from "../../components/SessionGraph";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import GlucoseManager from "../../components/GlucoseManager";
import InsulinManager from "../../components/InsulinManager";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import WizardManager from "../../lib/wizardManager";
import { WizardState } from "../../models/wizardState";
import { useWizardSession } from "../../state/useSession";
import useMeal from "../../state/useMeal";
import { Button } from "react-bootstrap";
import SessionSummary from "../../components/SessionSummary";

export default function WizardEditPage() {
  const session = useWizardSession();
  const meal = useMeal(session.latestMeal);

  const navigate = useNavigate();
  function finishEdit() {
    WizardManager.moveToPage(WizardState.Summary, navigate);
  }
  return (
    <>
      <h1>Edit Session Events</h1>
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
        <InsulinManager session={session} />
      </Card>

      <Card>
        <GlucoseManager session={session} />
      </Card>

      <Card>
        <SessionSummary session={session} />
      </Card>

      <Card>
        <SessionGraph session={session} from={-1} />
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={finishEdit}>
          Done
        </Button>
      </div>
    </>
  );
}
