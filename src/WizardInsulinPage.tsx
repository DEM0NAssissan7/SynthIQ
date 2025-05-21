import { useEffect, useMemo, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager from "./lib/wizardManager";
import { getEpochMinutes, getPrettyTime, round } from "./lib/util";
import { useNavigate } from "react-router";
import { WizardState } from "./models/wizardState";
import { useWizardMealState } from "./state/useWizardMeal";
import useInsulinPrediction from "./state/useInsulinPrediction";
import useVersion from "./state/useVersion";
import MealPredictedSugarGraphCard from "./components/MealPredictedSugarGraphCard";

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
        WizardManager.moveToPage(
          WizardManager.getMealMarked()
            ? WizardState.Summary
            : WizardState.MealConfirm,
          navigate
        );
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

  // We give the meal insulin now to show the user how it's probably going to look
  useEffect(() => {
    meal.insulins = [];
    meal.insulin(new Date(), suggestedInsulin);
  }, [version]);

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
        {WizardManager.getMealMarked() && optimalInsulinTiming > 0 && (
          <>
            {" "}
            in <b>{optimalInsulinTiming} minutes</b>
            {optimalInsulinTiming >= 30 && (
              <> ({getPrettyTime(insulinTimestamp)})</>
            )}
          </>
        )}
        .
      </p>
      {WizardManager.getMealMarked() && (
        <p>
          {timeEaten < 30 ? (
            <>
              You ate <b>{timeEaten} minutes</b> ago.
            </>
          ) : (
            <>
              You ate at <b>{getPrettyTime(meal.timestamp)}</b>.
            </>
          )}
        </p>
      )}
      <MealPredictedSugarGraphCard />
      <InputGroup className="mb-3">
        <InputGroup.Text id="basic-addon1">
          <i className="bi bi-capsule"></i>
        </InputGroup.Text>
        <Form.Control
          placeholder={round(suggestedInsulin, 2).toString()}
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
        {!WizardManager.getMealMarked() ? (
          <Button variant="secondary" onClick={goBack}>
            Go Back
          </Button>
        ) : (
          <div></div>
        )}
        <Button variant="primary" onClick={markInsulin}>
          Mark Insulin
        </Button>
      </div>
    </div>
  );
}
