import { useEffect, useMemo, useState } from "react";
import { Button, Form, InputGroup, ListGroup } from "react-bootstrap";
import WizardManager from "../managers/wizardManager";
import { roundByHalf } from "../lib/util";
import { useNavigate } from "react-router";
import BloodSugarInput from "../components/BloodSugarInput";
import {
  getCorrectionInsulin,
  getInsulin,
  getOvercompensationInsulins,
} from "../lib/metabolism";
import Card from "../components/Card";
import TemplateSummary from "../components/TemplateSummary";
import { WizardStore } from "../storage/wizardStore";
import { WizardPage } from "../models/types/wizardPage";
import { PreferencesStore } from "../storage/preferencesStore";
import RemoteTreatments from "../lib/remote/treatments";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { InsulinVariantStore } from "../storage/insulinVariantStore";
import { NumberOptionSelector } from "../components/NumberOptionSelector";

export default function InsulinPage() {
  const navigate = useNavigate();
  const [session] = WizardStore.session.useState();
  const [isBolus, setIsBolus] = WizardStore.isBolus.useState();

  const isFirstPostMealInjection = useMemo(
    () =>
      session.initialGlucose !== null &&
      session.insulins.length === 0 &&
      isBolus,
    [isBolus, session]
  );

  const now = new Date();
  const meal = session.mealMarked ? session.latestMeal : WizardStore.meal.value;
  const [template] = WizardStore.template.useState();
  const [variant, setVariant] = useState(InsulinVariantManager.getDefault());

  const suggestedInsulin = getInsulin(meal.carbs, meal.protein, variant);

  // Inputted Insulin
  const [insulinTaken, setInsulinTaken] = useState(0);
  const [currentGlucose, setCurrentGlucose] = useState<number | null>(null);
  const markInsulin = (insulin: number) => {
    if (!currentGlucose && isBolus && !isFirstPostMealInjection) {
      alert(`You must input your current blood sugar`);
      return;
    }
    if (!isNaN(insulin)) {
      if (confirm(`Confirm that you have taken ${insulin} units of insulin`)) {
        if (isBolus && (currentGlucose || session.initialGlucose)) {
          const BG =
            currentGlucose ??
            session.initialGlucose ??
            PreferencesStore.targetBG.value;
          WizardManager.markInsulin(insulin, BG, variant.name);
          if (currentGlucose) WizardManager.setInitialGlucose(currentGlucose);
        }
        if (session.started) {
          WizardManager.moveToPage(
            session.mealMarked ? WizardPage.Hub : WizardPage.Meal,
            navigate
          );
        } else {
          navigate("/hub");
        }

        // TODO: Use date selector
        RemoteTreatments.markInsulin(insulin, now, variant.name);
        setIsBolus(false);
      }
    } else {
      alert("Please enter a valid number");
    }
  };
  function onMark() {
    markInsulin(insulinTaken);
  }

  const correctionInsulin = useMemo(() => {
    return currentGlucose
      ? roundByHalf(getCorrectionInsulin(currentGlucose, variant))
      : 0;
  }, [currentGlucose, variant]);
  const overshootInsulinOffset = getOvercompensationInsulins(
    currentGlucose ?? PreferencesStore.targetBG.value,
    [variant]
  )[0];

  const displayedInsulin = (() => {
    if (session.insulin !== 0 && correctionInsulin > 0)
      return correctionInsulin;
    if (!isBolus) return correctionInsulin;
    const insulins = template.vectorizeInsulin(
      meal.carbs,
      meal.protein,
      now,
      currentGlucose ? currentGlucose : PreferencesStore.targetBG.value
    );
    let insulin: number = suggestedInsulin;
    if (insulins) {
      insulin = 0;
      insulins.forEach((i) => (insulin += i.value));
    }
    return (
      insulin + correctionInsulin + overshootInsulinOffset - session.insulin
    );
  })();

  // A variable that changes once per minute
  function goBack() {
    WizardStore.isBolus.value = false;
    WizardManager.moveToPage(
      session.mealMarked ? WizardPage.Hub : WizardPage.Meal,
      navigate
    );
  }

  // Set usage state based on the current session state
  useEffect(() => {
    if (!isBolus) setIsBolus(session.started);
  }, []);

  return (
    <div>
      <h1>Insulin Dosing</h1>
      {isBolus && (
        <Card>
          <TemplateSummary
            template={template}
            session={session}
            meal={meal}
            currentBG={
              session.initialGlucose
                ? undefined
                : currentGlucose || PreferencesStore.targetBG.value
            }
          />
        </Card>
      )}

      <Card>
        {!isFirstPostMealInjection && (
          <BloodSugarInput
            initialGlucose={currentGlucose}
            setInitialGlucose={setCurrentGlucose}
            pullFromNightscout={!isBolus}
          />
        )}
        <ListGroup>
          <Form.Label>Variant</Form.Label>
          <Form.Select
            onChange={(e) => {
              // You can handle insulin type selection here if needed
              const v = InsulinVariantManager.getVariant(e.target.value);
              if (v) setVariant(v);
            }}
            className="mb-2"
          >
            {InsulinVariantStore.variants.value.map((v) => (
              <option value={v.name}>{v.name}</option>
            ))}
          </Form.Select>
        </ListGroup>
        <InputGroup className="mb-3">
          <InputGroup.Text id="basic-addon1">
            <i className="bi bi-capsule"></i>
          </InputGroup.Text>
          <Form.Control
            type="number"
            placeholder={roundByHalf(displayedInsulin).toString()}
            aria-describedby="basic-addon1"
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setInsulinTaken(val);
              else setInsulinTaken(0);
            }}
          />
          <InputGroup.Text id="basic-addon1">u</InputGroup.Text>
        </InputGroup>
        <div className="d-flex justify-content-center flex-wrap">
          <NumberOptionSelector
            value={roundByHalf(displayedInsulin)}
            rangeFromOrigin={2}
            increment={0.5}
            labelSuffix="u"
            onSelect={(val) => {
              markInsulin(val);
            }}
          />
        </div>
      </Card>
      <div className="d-flex justify-content-between">
        {isBolus && (
          <Button variant="secondary" onClick={goBack}>
            Go Back
          </Button>
        )}
        <div className="ms-auto">
          <Button variant="primary" onClick={onMark}>
            Mark Insulin
          </Button>
        </div>
      </div>
    </div>
  );
}
