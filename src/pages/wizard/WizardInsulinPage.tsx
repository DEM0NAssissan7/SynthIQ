import { useEffect, useMemo, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager from "../../lib/wizardManager";
import { round } from "../../lib/util";
import { useNavigate } from "react-router";
import { WizardState } from "../../models/wizardState";
import useInsulinPrediction from "../../state/useInsulinPrediction";
import useVersion from "../../state/useVersion";
import EventPredictedSugarGraphCard from "../../components/EventPredictedSugarGraphCard";
import { getMinuteDiff, getPrettyTime } from "../../lib/timing";
import { useWizardEvent } from "../../state/useEvent";

export default function WizardInsulinPage() {
  const navigate = useNavigate();
  const event = useWizardEvent();

  const { insulin: suggestedInsulin, insulinTimestamp } = useInsulinPrediction(
    event,
    event.carbs,
    event.protein,
    event.initialGlucose,
    false
  );

  // Inputted Insulin
  const [insulinTaken, setInsulinTaken] = useState(0);
  const markInsulin = () => {
    if (!isNaN(insulinTaken)) {
      if (
        confirm(`Confirm that you have taken ${insulinTaken} units of insulin`)
      ) {
        event.clearTestInsulins();
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
    event.clearTestInsulins();
    event.createTestInsulin(
      new Date(),
      insulinTaken ? insulinTaken : suggestedInsulin
    );
  }, [version, insulinTaken]);

  // Timing Info (for user)
  const optimalInsulinTiming = useMemo(() => {
    return getMinuteDiff(insulinTimestamp, new Date());
  }, [version, insulinTimestamp]);

  const timeEaten = useMemo(() => {
    return getMinuteDiff(new Date(), event.timestamp);
  }, [version]);

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
      {WizardManager.getMealMarked() && (
        <p>
          {timeEaten < 30 ? (
            <>
              You ate <b>{timeEaten} minutes</b> ago.
            </>
          ) : (
            <>
              You ate at <b>{getPrettyTime(event.timestamp)}</b>.
            </>
          )}
        </p>
      )}
      {WizardManager.getInsulinMarked() && (
        <p>
          You have already taken <b>{event.insulin} units</b> of insulin. <br />
          Your last dose was at{" "}
          <b>{getPrettyTime(event.latestInsulinTimestamp)}</b>.
        </p>
      )}
      <EventPredictedSugarGraphCard event={event} />
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
        <Button variant="primary" onClick={markInsulin}>
          Mark Insulin
        </Button>
      </div>
    </div>
  );
}
