import { useNavigate } from "react-router";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import Card from "../../components/Card";
import SessionGraph from "../../components/SessionGraph";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import GlucoseManager from "../../components/GlucoseManager";
import InsulinManager from "../../components/InsulinManager";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import WizardManager from "../../lib/wizardManager";
import { WizardState } from "../../models/types/wizardState";
import { useWizardSession } from "../../state/useSession";
import { Button } from "react-bootstrap";
import SessionSummary from "../../components/SessionSummary";
import { useMemo, useState } from "react";
import { Dropdown } from "react-bootstrap";
import BloodSugarInput from "../../components/BloodSugarInput";

export default function WizardEditPage() {
  const session = useWizardSession();
  const [selectedMealIndex, setSelectedMealIndex] = useState(0);
  const meal = useMemo(
    () => session.meals[selectedMealIndex],
    [selectedMealIndex]
  );

  const navigate = useNavigate();
  function finishEdit() {
    WizardManager.moveToPage(WizardState.Summary, navigate);
  }
  return (
    <>
      <h1>Edit Session Events</h1>
      <Card>
        <Dropdown
          onSelect={(eventKey) =>
            setSelectedMealIndex(parseInt(eventKey ? eventKey : ""))
          }
        >
          <Dropdown.Toggle variant="secondary" id="meal-dropdown">
            Meal {selectedMealIndex + 1}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {session.meals.map((_, i: number) => (
              <Dropdown.Item key={i} eventKey={i}>
                Meal {i + 1}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </Card>
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
        <BloodSugarInput
          initialGlucose={session.initialGlucose}
          setInitialGlucose={(g) => (session.initialGlucose = g)}
          pullFromNightscout={false}
          showAutoButton={false}
          label="Initial Blood Sugar"
        />
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
