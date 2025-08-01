import { useNavigate } from "react-router";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import Card from "../../components/Card";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import GlucoseManager from "../../components/GlucoseManager";
import InsulinManager from "../../components/InsulinManager";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import { useWizardSession } from "../../state/useSession";
import { Button } from "react-bootstrap";
import { useMemo, useState } from "react";
import { Dropdown } from "react-bootstrap";
import TemplateManager from "../../lib/templateManager";
import { TemplateState } from "../../models/types/templateState";
import BloodSugarInput from "../../components/BloodSugarInput";
import TemplateSummary from "../../components/TemplateSummary";

export default function TemplateEditPage() {
  const session = useWizardSession();
  const [selectedMealIndex, setSelectedMealIndex] = useState(0);
  const meal = useMemo(
    () => session.meals[selectedMealIndex],
    [selectedMealIndex]
  );
  const template = TemplateManager.getTemplate();

  const navigate = useNavigate();
  function finishEdit() {
    TemplateManager.moveToPage(TemplateState.Hub, navigate);
  }
  function setGlucose(a: number) {
    session.initialGlucose = a;
  }
  return (
    <>
      <h1>Edit Session Events</h1>
      <Card>
        <TemplateSummary template={template} session={session} />
      </Card>
      <Card>
        <Dropdown
          onSelect={(eventKey) =>
            setSelectedMealIndex(parseInt(eventKey ? eventKey : ""))
          }
        >
          <Dropdown.Toggle variant="secondary" id="meal-dropdown">
            {`Meal ${selectedMealIndex + 1}`}
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
          setInitialGlucose={setGlucose}
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

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={finishEdit}>
          Done
        </Button>
      </div>
    </>
  );
}
