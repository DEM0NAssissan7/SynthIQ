/** We show the user their current sugar curves compared to what we predict it to be. This will include glucose shots, too.
 *
 */

import MealGraph from "../../components/MealGraph";
import WizardManager from "../../lib/wizardManager";
import { Button, ListGroup } from "react-bootstrap";
import { useNavigate } from "react-router";
import { getPrettyTime, round } from "../../lib/util";
import { useWizardMealState } from "../../state/useWizardMeal";

export default function WizardSummaryPage() {
  const { meal, carbs, protein, insulin, insulinTimestamp } =
    useWizardMealState();
  const navigate = useNavigate();

  function startNew() {
    if (
      confirm(
        "Are you sure you want to start a new meal? You cannot come back to this page if you do."
      )
    ) {
      WizardManager.startNew(navigate);
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <div className="check">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="feather feather-check-circle"
            style={{ width: "50px", height: "50px", color: "green" }}
          >
            <path d="M9 12l2 2 4-4"></path>
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        </div>
        <h1>Event Summary</h1>
      </div>
      <div className="card mb-4" id="food-adder">
        <div className="card-body">
          <ListGroup.Item>
            Meal eaten at {getPrettyTime(meal._timestamp)}
            <br></br>- {round(carbs, 2)}g carbs<br></br>- {round(protein, 2)}g
            protein
            <br />
            <br />
            <b>{round(insulin, 2)}u</b> insulin (
            {getPrettyTime(insulinTimestamp)})
          </ListGroup.Item>
        </div>
      </div>
      <div className="card mb-4" id="food-adder">
        <div className="card-body">
          <p>
            Watch in real-time how your blood sugars compare with our
            predictions.
          </p>
          <MealGraph
            meal={meal}
            from={-1}
            until={16}
            width="100%"
            height={300}
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={startNew}>
          Start New Meal
        </Button>
      </div>
    </>
  );
}
