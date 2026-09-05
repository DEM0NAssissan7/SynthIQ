import { useNavigate } from "react-router";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import Card from "../../components/Card";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import GlucoseManager from "../../components/GlucoseManager";
import InsulinManager from "../../components/InsulinManager";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import { Button } from "react-bootstrap";
import BloodSugarInput from "../../components/BloodSugarInput";
import TemplateSummary from "../../components/summary/TemplateSummary";
import { WizardStore } from "../../storage/wizardStore";
import { PreferencesStore } from "../../storage/preferencesStore";
import {
  PageActions,
  PageHeader,
  PageLayout,
} from "../../components/PageLayout";

export default function WizardEditPage() {
  const [session] = WizardStore.session.useState();
  const meal = session.meal;
  const [template] = WizardStore.activeTemplate.useState();

  const navigate = useNavigate();
  function finishEdit() {
    navigate("/hub");
  }
  function setGlucose(_: number) {
    // session.initialGlucose = a;
  }
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Wizard"
        title="Edit session"
        subtitle="Adjust meal events, insulin, glucose, and the stored starting BG without losing the session context."
      />
      <Card>
        <TemplateSummary template={template} session={session} />
      </Card>
      {meal && (
        <>
          <Card>
            <FoodSearchDisplay meal={meal} />
          </Card>

          <Card>
            <AddedFoodsDisplay meal={meal} />
          </Card>

          <Card>
            <MealAdditionalNutrients meal={meal} />
          </Card>
        </>
      )}

      <Card>
        <BloodSugarInput
          initialGlucose={
            session.initialGlucose
              ? session.initialGlucose
              : PreferencesStore.targetBG.value
          }
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

      <PageActions>
        <Button variant="primary" onClick={finishEdit}>
          Done
        </Button>
      </PageActions>
    </PageLayout>
  );
}
