import { useMemo, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager from "../lib/wizardManager";
import { getEpochMinutes, round } from "../lib/util";
import { useNavigate } from "react-router";
import { WizardState } from "../models/wizardState";
import { useWizardMealState } from "../state/useWizardMeal";
import useInsulinPrediction from "../state/useInsulinPrediction";
import useVersion from "../state/useVersion";

export default function WizardInsulinPage() {
  const navigate = useNavigate();
  const { meal, carbs, protein, initialGlucose } = useWizardMealState();
  const { insulin: suggestedInsulin, insulinTimestamp } = useInsulinPrediction(
    meal,
    carbs,
    protein,
    initialGlucose,
    false
  );

  // Inputted Insulin
  const [insulinTaken, setInsulinTaken] = useState(0);
  const markInsulin = () => {
    if (!isNaN(insulinTaken)) {
      if (
        confirm(`Confirm that you have taken ${insulinTaken} units of insulin`)
      ) {
        WizardManager.markInsulin(insulinTaken);
        WizardManager.moveToPage(WizardState.Meal, navigate);
      }
    } else {
      alert("Please enter a valid number");
    }
  };

  // A variable that changes once per minute
  const version = useVersion(1);

  function goBack() {
    if (!WizardManager.getMealMarked())
      WizardManager.moveToPage(WizardState.Meal, navigate);
    else
      throw new Error(
        "Something went horribly wrong in the router. This should not be happening"
      );
  }

  // Timing Info (for user)
  const optimalInsulinTiming = useMemo(() => {
    return getEpochMinutes(insulinTimestamp) - getEpochMinutes(new Date());
  }, [version]);

  const timeEaten = useMemo(() => {
    return getEpochMinutes(new Date()) - getEpochMinutes(meal.timestamp);
  }, [version]);

  return (
    <div>
      <h1>Insulin Dosing</h1>
      <p>
        Take however much insulin you wish. However, our algorithm think you
        should take <b>{round(suggestedInsulin, 2)}</b> units
        {WizardManager.getMealMarked() && optimalInsulinTiming < 0 && (
          <>
            {" "}
            in <b>{optimalInsulinTiming} minutes</b>
          </>
        )}
        .
      </p>
      {WizardManager.getMealMarked() && (
        <p>
          You ate <b>{timeEaten} minutes</b> ago.
        </p>
      )}
      <InputGroup className="mb-3">
        <InputGroup.Text id="basic-addon1">
          <i className="bi bi-capsule"></i>
        </InputGroup.Text>
        <Form.Control
          placeholder={round(insulinTaken, 2).toString()}
          aria-label="URL"
          aria-describedby="basic-addon1"
          onChange={(e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) setInsulinTaken(e.target.value);
            else setInsulinTaken(0);
          }}
        />
        <InputGroup.Text id="basic-addon1">u</InputGroup.Text>
      </InputGroup>
      <div className="d-flex justify-content-between">
        {!WizardManager.getMealMarked() && (
          <Button variant="secondary" onClick={goBack}>
            Go Back
          </Button>
        )}
        <Button variant="primary" onClick={markInsulin}>
          Mark Insulin
        </Button>
      </div>
    </div>
  );
}
