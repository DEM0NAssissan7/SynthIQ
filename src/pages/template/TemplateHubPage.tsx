import { Button, ToggleButton } from "react-bootstrap";
import Card from "../../components/Card";
import TemplateSessionSummary from "../../components/TemplateSessionSummary";
import TemplateManager from "../../lib/templateManager";
import { useWizardSession } from "../../state/useSession";
import { TemplateState } from "../../models/types/templateState";
import { useNavigate } from "react-router";
import WizardManager from "../../lib/wizardManager";

export default function TemplateHubPage() {
  const session = useWizardSession();
  const template = TemplateManager.getTemplate();

  // Garbage
  function setGarbage(value: boolean) {
    if (value === true) {
      if (confirm("Do you want to mark this session as unreliable?"))
        session.isGarbage = value;
    } else session.isGarbage = value;
  }

  const navigate = useNavigate();

  function startNew() {
    TemplateManager.moveToPage(TemplateState.FinalBG, navigate);
  }
  function takeInsulin() {
    TemplateManager.moveToPage(TemplateState.Insulin, navigate);
  }
  function addMeal() {
    TemplateManager.moveToPage(TemplateState.Meal, navigate);
  }
  function takeGlucose() {
    navigate("/rescue");
  }
  function editSession() {
    TemplateManager.moveToPage(TemplateState.Edit, navigate);
  }
  function cancelSession() {
    WizardManager.cancelSession(navigate);
  }

  return (
    <>
      {" "}
      <Card>
        <TemplateSessionSummary session={session} template={template} />
      </Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "40px",
          marginTop: "20px",
        }}
      >
        {/* LEFT COLUMN */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <Button variant="secondary" onClick={startNew}>
            End Session
          </Button>
          <Button variant="secondary" onClick={editSession}>
            Edit Session
          </Button>
          <Button variant="danger" onClick={cancelSession}>
            Cancel Session
          </Button>
          <ToggleButton
            id="toggle-check"
            type="checkbox"
            variant="outline-danger"
            checked={session.isGarbage}
            value="1"
            onChange={(e) => setGarbage(e.currentTarget.checked)}
          >
            Exclude Session
          </ToggleButton>
        </div>

        {/* RIGHT COLUMN */}
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
          <Button
            variant={WizardManager.getMealMarked() ? "danger" : "primary"}
            onClick={addMeal}
          >
            Eat {WizardManager.getMealMarked() && "Additional"} Meal
          </Button>
          <Button
            variant={WizardManager.getInsulinMarked() ? "danger" : "primary"}
            onClick={takeInsulin}
          >
            Take {WizardManager.getInsulinMarked() && "Additional"} Insulin
          </Button>
        </div>
      </div>
    </>
  );
}
