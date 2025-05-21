import { useEffect, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager from "../lib/wizardManager";
import { convertDimensions, getHourDiff, round } from "../lib/util";
import { useNavigate } from "react-router";
import { getOptimalInsulinTiming } from "../lib/metabolism";
import Unit from "../models/unit";
import { wizardStorage } from "../storage/wizardStore";
import { WizardState } from "../models/wizardState";

export default function WizardInsulinPage() {
  const navigate = useNavigate();
  const meal = wizardStorage.get("meal");
  const [insulin, setInsulin] = useState("");

  const handleMarkInsulin = () => {
    const units = parseFloat(insulin);
    if (!isNaN(units)) {
      if (confirm(`Confirm that you have taken ${units} units of insulin`)) {
        WizardManager.markInsulin(units);
        WizardManager.moveToPage(WizardState.Meal, navigate);
      }
    } else {
      alert("Please enter a valid number");
    }
  };
  function getInsulin() {
    return round(meal.getInsulin(), 2).toString();
  }

  function goBack() {
    WizardManager.moveToPage(WizardState.Meal, navigate);
  }

  // Timing
  const [suggestedTiming, setSuggestedTiming] = useState(getSuggestedTiming());

  function getSuggestedTiming(): number {
    let timestamp = WizardManager.getMealMarked() ? new Date() : meal.timestamp;
    return round(
      getHourDiff(
        getOptimalInsulinTiming(meal, meal.getInsulin(), -2, 6),
        timestamp
      ) * 60,
      0
    );
  }

  const [timeEaten, setTimeEaten] = useState(0);
  function getWhenEaten() {
    return round(getHourDiff(meal.timestamp, new Date()) * 60, 0);
  }
  useEffect(() => {
    const handler = () => {
      setSuggestedTiming(getSuggestedTiming());
      if (WizardManager.getMealMarked()) setTimeEaten(getWhenEaten());
    };
    setInterval(handler, convertDimensions(Unit.Time.Minute, Unit.Time.Millis));
    handler();
  }, []);

  return (
    <div>
      <h1>Insulin Dosing</h1>
      <p>
        Take however much insulin you wish. However, our algorithm think you
        should take <b>{getInsulin()}</b> units
        {WizardManager.getMealMarked() && suggestedTiming < 0 && (
          <>
            {" "}
            in <b>{-suggestedTiming} minutes</b>
          </>
        )}
        .
      </p>
      {suggestedTiming > 0 && (
        <p>
          Likewise, eat whenever you feel is best. Our algorithm suggests that
          you eat <b>{suggestedTiming} minutes</b> after taking insulin.
        </p>
      )}
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
          placeholder={getInsulin()}
          aria-label="URL"
          aria-describedby="basic-addon1"
          onChange={(e: any) => setInsulin(e.target.value)}
        />
        <InputGroup.Text id="basic-addon1">u</InputGroup.Text>
      </InputGroup>
      <div className="d-flex justify-content-between">
        {!WizardManager.getMealMarked() && (
          <Button variant="secondary" onClick={goBack}>
            Go Back
          </Button>
        )}
        <Button variant="primary" onClick={handleMarkInsulin}>
          Mark Insulin
        </Button>
      </div>
    </div>
  );
}
