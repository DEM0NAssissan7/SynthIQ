/** We show the user their current sugar curves compared to what we predict it to be. This will include glucose shots, too.
 *
 */

import { useEffect, useMemo } from "react";
import MealGraph from "../components/MealGraph";
import WizardManager from "../lib/wizardManager";
import type Meal from "../models/meal";
import { Button, Form, ListGroup } from "react-bootstrap";
import { useNavigate } from "react-router";
import { convertDimensions, getPrettyTime, round } from "../lib/util";
import Unit from "../models/unit";
import { wizardStorage } from "../storage/wizardStore";
import { useWizardMealState } from "../state/useWizardMeal";
import useVersion from "../state/useVersion";

export default function WizardSummaryPage() {
  const { meal, carbs, protein, insulin, insulinTimestamp } =
    useWizardMealState();
  const navigate = useNavigate();

  // Update every minute
  const version = useVersion(1);

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
          <Form.Label>Summary</Form.Label>
          <ListGroup.Item>
            Meal eaten at {getPrettyTime(meal.timestamp)}
            <br></br>- {round(carbs, 2)}g carbs<br></br>- {round(protein, 2)}g
            protein<br></br>
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
      <Button
        onClick={() => {
          if (
            confirm(
              "Are you sure you want to start a new meal? You cannot come back to this page if you do."
            )
          ) {
            WizardManager.startNew(navigate);
          }
        }}
      >
        Start New Meal
      </Button>
    </>
  );
}
