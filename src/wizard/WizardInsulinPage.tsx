import { useEffect, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import WizardManager, {
  WizardState,
  wizardStorage,
} from "../lib/wizardManager";
import { getHourDiff, round } from "../lib/util";
import { useNavigate } from "react-router";
import { getOptimalInsulinTiming } from "../lib/metabolism";

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
  const [mealTiming, setMealTiming] = useState(getMealTiming());

  function getMealTiming(): number {
    let timestamp = WizardManager.getMealMarked() ? new Date() : new Date();
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
    setInterval(() => {
      setMealTiming(getMealTiming());
      if (WizardManager.getMealMarked()) setTimeEaten(getWhenEaten());
    });
  }, []);

  return (
    <div>
      <h1>Insulin Dosing</h1>
      <p>
        Take however much insulin you wish. However, our algorithm think you
        should take <b>{getInsulin()}</b> units
        {WizardManager.getMealMarked() && mealTiming < 0 && (
          <>
            {" "}
            in <b>{-mealTiming} minutes</b>
          </>
        )}
        .
      </p>
      {mealTiming > 0 && (
        <p>
          Likewise, eat whenever you feel is best. Our algorithm suggests that
          you eat in <b>{mealTiming} minutes</b>.
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
