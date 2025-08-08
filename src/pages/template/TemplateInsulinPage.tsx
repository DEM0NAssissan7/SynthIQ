import { useEffect, useMemo, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager from "../../lib/wizardManager";
import { round } from "../../lib/util";
import { useNavigate } from "react-router";
import useVersion from "../../state/useVersion";
import { useWizardSession } from "../../state/useSession";
import { useWizardMeal } from "../../state/useMeal";
import BloodSugarInput from "../../components/BloodSugarInput";
import { getCorrectionInsulin, getInsulin } from "../../lib/metabolism";
import Card from "../../components/Card";
import TemplateManager from "../../lib/templateManager";
import { TemplateState } from "../../models/types/templateState";
import TemplateSummary from "../../components/TemplateSummary";

export default function TemplateInsulinPage() {
  const navigate = useNavigate();
  const session = useWizardSession();
  const meal = WizardManager.getMealMarked()
    ? session.latestMeal
    : useWizardMeal();
  const template = TemplateManager.getTemplate();

  const suggestedInsulin = getInsulin(meal.carbs, meal.protein);

  // Inputted Insulin
  const [insulinTaken, setInsulinTaken] = useState(0);
  const [currentGlucose, setCurrentGlucose] = useState(session.initialGlucose);
  function setGlucose(value: number) {
    setCurrentGlucose(value);
    WizardManager.setInitialGlucose(value, false);
  }
  const markInsulin = () => {
    if (!isNaN(insulinTaken)) {
      if (
        confirm(`Confirm that you have taken ${insulinTaken} units of insulin`)
      ) {
        session.clearTestInsulins();
        WizardManager.markInsulin(insulinTaken);
        WizardManager.setInitialGlucose(currentGlucose);
        TemplateManager.moveToPage(
          WizardManager.getMealMarked()
            ? TemplateState.Hub
            : TemplateState.Meal,
          navigate
        );
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
  const version = useVersion(1);
  function goBack() {
    TemplateManager.moveToPage(
      WizardManager.getMealMarked() ? TemplateState.Hub : TemplateState.Meal,
      navigate
    );
  }

  // We show the user what we predict if they take insulin now
  useEffect(() => {
    session.clearTestInsulins();
    session.createTestInsulin(
      new Date(),
      insulinTaken ? insulinTaken : displayedInsulin
    );
  }, [version, insulinTaken, displayedInsulin]);

  return (
    <div>
      <h1>Insulin Dosing</h1>
      <Card>
        <TemplateSummary
          template={template}
          session={session}
          meal={meal}
          currentBG={currentGlucose}
        />
      </Card>

      <Card>
        <BloodSugarInput
          initialGlucose={currentGlucose}
          setInitialGlucose={setGlucose}
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
