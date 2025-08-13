import { useMemo, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager from "../../lib/wizardManager";
import { round } from "../../lib/util";
import { useNavigate } from "react-router";
import BloodSugarInput from "../../components/BloodSugarInput";
import { getCorrectionInsulin, getInsulin } from "../../lib/metabolism";
import Card from "../../components/Card";
import TemplateSummary from "../../components/TemplateSummary";
import { WizardStore } from "../../storage/wizardStore";
import { WizardPage } from "../../models/types/wizardState";
import { PreferencesStore } from "../../storage/preferencesStore";

export default function WizardInsulinPage() {
  const navigate = useNavigate();
  const [session] = WizardStore.session.useState();
  const meal = session.mealMarked
    ? session.latestMeal
    : WizardStore.meal.useState()[0];
  const [template] = WizardStore.template.useState();

  const suggestedInsulin = getInsulin(meal.carbs, meal.protein);

  // Inputted Insulin
  const [insulinTaken, setInsulinTaken] = useState(0);
  const [currentGlucose, setCurrentGlucose] = useState(
    session.initialGlucose
      ? session.initialGlucose
      : PreferencesStore.targetBG.value
  );
  const markInsulin = () => {
    if (!isNaN(insulinTaken)) {
      if (
        confirm(`Confirm that you have taken ${insulinTaken} units of insulin`)
      ) {
        WizardManager.markInsulin(insulinTaken, currentGlucose);
        WizardManager.setInitialGlucose(currentGlucose);
        if (session.started) {
          WizardManager.moveToPage(
            session.mealMarked ? WizardPage.Hub : WizardPage.Meal,
            navigate
          );
        } else {
          navigate("/hub");
        }
      }
    } else {
      alert("Please enter a valid number");
    }
  };

  const correctionInsulin = useMemo(() => {
    return round(getCorrectionInsulin(currentGlucose), 1);
  }, [currentGlucose]);

  const displayedInsulin = useMemo(() => {
    if (session.insulin !== 0 && correctionInsulin > 0)
      return correctionInsulin;
    if (session.insulin === 0) {
      let insulin = template.vectorizeInsulin(meal.carbs, meal.protein);
      if (!insulin) insulin = suggestedInsulin;
      return insulin + correctionInsulin;
    }
    return Math.max(suggestedInsulin - session.insulin, 0);
  }, [session, correctionInsulin, suggestedInsulin]);

  // A variable that changes once per minute
  function goBack() {
    WizardManager.moveToPage(
      session.mealMarked ? WizardPage.Hub : WizardPage.Meal,
      navigate
    );
  }

  return (
    <div>
      <h1>Insulin Dosing</h1>
      <Card>
        <TemplateSummary
          template={template}
          session={session}
          meal={meal}
          currentBG={session.initialGlucose ? undefined : currentGlucose}
        />
      </Card>

      <Card>
        <BloodSugarInput
          initialGlucose={currentGlucose}
          setInitialGlucose={setCurrentGlucose}
        />
        <InputGroup className="mb-3">
          <InputGroup.Text id="basic-addon1">
            <i className="bi bi-capsule"></i>
          </InputGroup.Text>
          <Form.Control
            placeholder={round(displayedInsulin, 2).toString()}
            aria-describedby="basic-addon1"
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setInsulinTaken(val);
              else setInsulinTaken(0);
            }}
          />
          <InputGroup.Text id="basic-addon1">u</InputGroup.Text>
        </InputGroup>
      </Card>
      <div className="d-flex justify-content-between">
        <Button variant="secondary" onClick={goBack}>
          Go Back
        </Button>
        <Button variant="primary" onClick={markInsulin}>
          Mark Insulin
        </Button>
      </div>
    </div>
  );
}
