import { Button, Form, ListGroup } from "react-bootstrap";
import { useEffect, useState } from "react";
import { round } from "../../lib/util";
import { useNavigate } from "react-router";
import BloodSugarInput from "../../components/BloodSugarInput";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import { useWizardMeal } from "../../state/useMeal";
import { useWizardSession } from "../../state/useSession";
import Card from "../../components/Card";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import TemplateManager from "../../lib/templateManager";
import { TemplateState } from "../../models/types/templateState";
import WizardManager from "../../lib/wizardManager";
import TemplateStateSummary from "../../components/TemplateStateSummary";
import { profile } from "../../storage/metaProfileStore";
import TemplateSessionSummary from "../../components/TemplateSessionSummary";

export default function TemplateMealPage() {
  const session = useWizardSession();
  const meal = useWizardMeal();
  const template = TemplateManager.getTemplate();

  const [initialGlucose, setInitialGlucose] = useState(profile.target);
  const navigate = useNavigate();
  function goBack() {
    TemplateManager.moveToPage(TemplateState.Hub, navigate);
  }
  function goToSelect() {
    TemplateManager.moveToPage(TemplateState.Select, navigate);
  }
  function beginEating() {
    if (confirm("Are you ready to start eating?")) {
      WizardManager.markMeal();
      WizardManager.setInitialGlucose(initialGlucose);
      TemplateManager.moveToPage(
        WizardManager.getInsulinMarked()
          ? TemplateState.Hub
          : TemplateState.Insulin,
        navigate
      );
    }
  }
  function markInsulin() {
    TemplateManager.moveToPage(TemplateState.Insulin, navigate);
  }

  // Upon Startup
  useEffect(() => {
    // We intentionally assign the timestamp directly so that we do not trigger notify()
    meal._timestamp = new Date();
  });

  // We add the meal to the testmeals upon change
  useEffect(() => {
    session.clearTests();
    session.addTestMeal(meal);
  }, []);

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
            {round(meal.carbs, 2)}g carbs<br></br>
            {round(meal.protein, 2)}g protein<br></br>
          </ListGroup.Item>
          {WizardManager.getMealMarked() && (
            <ListGroup.Item>
              <TemplateSessionSummary template={template} session={session} />
            </ListGroup.Item>
          )}
          {!WizardManager.getInsulinMarked() && (
            <ListGroup.Item>
              <TemplateStateSummary
                template={template}
                session={session}
                meal={meal}
                currentGlucose={initialGlucose}
              />
            </ListGroup.Item>
          )}
          {!WizardManager.getInitialGlucoseMarked() && (
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
        {!WizardManager.isActive() && (
          <Button onClick={goToSelect} variant="secondary">
            Go Back
          </Button>
        )}
        {WizardManager.getInsulinMarked() ? (
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
