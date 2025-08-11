import { Button } from "react-bootstrap";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import WizardManager from "../../lib/wizardManager";

export default function WizardIntroPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // WizardManager.setState(WizardState.Intro, navigate);
  });
  return (
    <div>
      <div
        style={{
          background: "#fff3cd",
          color: "#856404",
          padding: "12px 16px",
          borderRadius: 4,
          border: "1px solid #ffeeba",
          marginBottom: 24,
        }}
      >
        <strong>Warning:</strong> Never use this app for medical decisions.
        Always consult your healthcare provider. This app is for educational
        purposes only.
      </div>
      <h1>Welcome to the Meal Creation Wizard</h1>
      <p>Follow these three easy steps to create your perfect meal plan!</p>

      <h2>Step 1: Create your meal</h2>
      <p>
        First, put the details of your meal (i.e. foods & measurements, any
        extra carbs/protein, etc.){" "}
      </p>

      <h2>Step 2: Inject Insulin (or eat)</h2>
      <p>
        Depending on your choice, you can choose to take your insulin before or
        after. Make sure to confirm that you've begun eating!
      </p>
      <h2>Step 3: Magic!</h2>
      <p>
        After you finish eating & taking your insulin, watch a live preview of
        your blood sugar compared to the predicted curves.
      </p>
      <Button
        variant="primary"
        onClick={() => {
          WizardManager.moveToFirstPage(navigate);
        }}
      >
        Continue
      </Button>
    </div>
  );
}
