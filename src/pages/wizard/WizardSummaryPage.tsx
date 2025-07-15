/** We show the user their current sugar curves compared to what we predict it to be. This will include glucose shots, too.
 *
 */

import WizardManager from "../../lib/wizardManager";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router";
import { WizardState } from "../../models/types/wizardState";
import SessionGraph from "../../components/SessionGraph";
import { useWizardSession } from "../../state/useSession";
import Card from "../../components/Card";
import SessionSummary from "../../components/SessionSummary";
import { useEffect } from "react";

export default function WizardSummaryPage() {
  const session = useWizardSession();
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
  function takeInsulin() {
    WizardManager.moveToPage(WizardState.Insulin, navigate);
  }
  function addMeal() {
    WizardManager.moveToPage(WizardState.Meal, navigate);
  }
  function takeGlucose() {
    WizardManager.moveToPage(WizardState.Glucose, navigate);
  }
  function editSession() {
    WizardManager.moveToPage(WizardState.Edit, navigate);
  }

  // Clear tests upon mount to prevent confusion and improve reliability
  useEffect(() => {
    session.clearTests();
  }, []);

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
        <h1>Session Summary</h1>
      </div>
      <Card>
        <SessionSummary session={session} />
      </Card>
      <Card>
        <p>
          Watch in real-time how your blood sugars compare with our predictions.
        </p>
        <SessionGraph session={session} from={-1} width="100%" height={300} />
      </Card>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          alignItems: "flex-end",
        }}
      >
        <Button variant="primary" onClick={takeGlucose}>
          Take Glucose
        </Button>
        <Button variant="danger" onClick={takeInsulin}>
          Take Additional Insulin
        </Button>
        <Button variant="danger" onClick={addMeal}>
          Eat Another Meal
        </Button>
        <Button variant="secondary" onClick={editSession}>
          Edit Session
        </Button>
        <Button variant="secondary" onClick={startNew}>
          Start New Session
        </Button>
      </div>
    </>
  );
}
