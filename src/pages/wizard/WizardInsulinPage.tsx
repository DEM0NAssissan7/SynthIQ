import { useEffect, useMemo, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager from "../../lib/wizardManager";
import { round } from "../../lib/util";
import { useNavigate } from "react-router";
import { WizardState } from "../../models/wizardState";
import useInsulinPrediction from "../../state/useInsulinPrediction";
import useVersion from "../../state/useVersion";
import SessionPredictedSugarGraphCard from "../../components/SessionPredictedSugarGraphCard";
import { getMinuteDiff, getPrettyTime } from "../../lib/timing";
import { useWizardSession } from "../../state/useSession";
import { useWizardMeal } from "../../state/useMeal";
import SessionSummary from "../../components/SessionSummary";

export default function WizardInsulinPage() {
  const navigate = useNavigate();
  const session = useWizardSession();
  const meal = WizardManager.getMealMarked()
    ? session.latestMeal
    : useWizardMeal();

  const { insulin: suggestedInsulin, insulinTimestamp } = useInsulinPrediction(
    session,
    meal.carbs,
    meal.protein,
    session.initialGlucose,
    false
  );

  // Inputted Insulin
  const [insulinTaken, setInsulinTaken] = useState(0);
  const markInsulin = () => {
    if (!isNaN(insulinTaken)) {
      if (
        confirm(`Confirm that you have taken ${insulinTaken} units of insulin`)
      ) {
        session.clearTestInsulins();
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

  //
  function cancelSession() {
    if (
      confirm(
        "Are you sure you want to discard the entire session? This will delete all data you've inputted so far for this session."
      )
    ) {
      WizardManager.resetWizard(navigate);
    }
  }

  // Correction
  function backToSummary() {
    WizardManager.moveToPage(WizardState.Summary, navigate);
  }

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

  // We show the user what we predict if they take insulin now
  useEffect(() => {
    session.clearTestInsulins();
    session.createTestInsulin(
      new Date(),
      insulinTaken ? insulinTaken : suggestedInsulin
    );
  }, [version, insulinTaken]);

  // Timing Info (for user)
  const optimalInsulinTiming = useMemo(() => {
    return getMinuteDiff(insulinTimestamp, new Date());
  }, [version, insulinTimestamp]);

  return (
    <div>
      <h1>Insulin Dosing</h1>
      {!WizardManager.getInsulinMarked() && (
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
      )}
      <hr />
      <SessionSummary session={session} />
      <hr />
      <SessionPredictedSugarGraphCard session={session} />
      <InputGroup className="mb-3">
        <InputGroup.Text id="basic-addon1">
          <i className="bi bi-capsule"></i>
        </InputGroup.Text>
        <Form.Control
          placeholder={round(suggestedInsulin, 2).toString()}
          aria-describedby="basic-addon1"
          onChange={(e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) setInsulinTaken(val);
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
          WizardManager.getInsulinMarked() && (
            <Button variant="secondary" onClick={backToSummary}>
              Return To Summary
            </Button>
          )
        )}
        {(WizardManager.getMealMarked() || WizardManager.getInsulinMarked()) &&
          !(
            WizardManager.getMealMarked() && WizardManager.getInsulinMarked()
          ) && (
            <Button variant="danger" onClick={cancelSession}>
              Cancel Session
            </Button>
          )}
        <Button variant="primary" onClick={markInsulin}>
          Mark Insulin
        </Button>
      </div>
    </div>
  );
}
