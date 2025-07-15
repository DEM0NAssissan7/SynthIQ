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
import BloodSugarInput from "../../components/BloodSugarInput";
import { getCorrectionInsulin } from "../../lib/metabolism";
import Card from "../../components/Card";

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
  const [currentGlucose, setCurrentGlucose] = useState(session.initialGlucose);
  const markInsulin = () => {
    if (!isNaN(insulinTaken)) {
      if (
        confirm(`Confirm that you have taken ${insulinTaken} units of insulin`)
      ) {
        session.clearTestInsulins();
        WizardManager.markInsulin(insulinTaken);
        if (!WizardManager.getInitialGlucoseMarked())
          WizardManager.setInitialGlucose(currentGlucose);
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

  const correctionInsulin = useMemo(() => {
    return round(getCorrectionInsulin(currentGlucose), 1);
  }, [currentGlucose]);

  const displayedInsulin = useMemo(() => {
    if (session.insulin !== 0 && correctionInsulin > 0)
      return correctionInsulin;
    if (session.insulin === 0) return suggestedInsulin;
    return Math.max(suggestedInsulin - session.insulin, 0);
  }, [session, correctionInsulin, suggestedInsulin]);

  // Misc
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

  // Session editing
  function editSession() {
    WizardManager.moveToPage(WizardState.Edit, navigate);
  }

  // We show the user what we predict if they take insulin now
  useEffect(() => {
    session.clearTestInsulins();
    session.createTestInsulin(
      new Date(),
      insulinTaken ? insulinTaken : displayedInsulin
    );
  }, [version, insulinTaken, displayedInsulin]);

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
          should take <b>{round(displayedInsulin, 2)}</b> units
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
        {!WizardManager.getMealMarked() ? (
          <Button variant="secondary" onClick={goBack}>
            Go Back
          </Button>
        ) : WizardManager.getInsulinMarked() ? (
          <Button variant="secondary" onClick={backToSummary}>
            Return To Summary
          </Button>
        ) : (
          <Button variant="secondary" onClick={editSession}>
            Edit Session
          </Button>
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
