import { Button, ToggleButton } from "react-bootstrap";
import Card from "../../components/Card";
import { useNavigate } from "react-router";
import WizardManager from "../../managers/wizardManager";
import TemplateSummary from "../../components/TemplateSummary";
import { WizardStore } from "../../storage/wizardStore";
import { WizardPage } from "../../models/types/wizardPage";

export default function WizardHubPage() {
  const [session] = WizardStore.session.useState();
  const [template] = WizardStore.template.useState();

  // Garbage
  function setGarbage(value: boolean) {
    if (value === true) {
      if (confirm("Do you want to mark this session as unreliable?"))
        session.isGarbage = value;
    } else session.isGarbage = value;
  }

  const navigate = useNavigate();

  function startNew() {
    WizardManager.moveToPage(WizardPage.FinalBG, navigate);
  }
  function takeInsulin() {
    WizardManager.moveToPage(WizardPage.Insulin, navigate);
  }
  function addMeal() {
    WizardManager.moveToPage(WizardPage.Meal, navigate);
  }
  function takeGlucose() {
    navigate("/rescue");
  }
  function editSession() {
    WizardManager.moveToPage(WizardPage.Edit, navigate);
  }
  function cancelSession() {
    WizardManager.cancelSession(navigate);
  }

  return (
    <>
      {" "}
      <Card>
        <TemplateSummary session={session} template={template} />
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
            variant={session.mealMarked ? "danger" : "primary"}
            onClick={addMeal}
          >
            Eat {session.mealMarked && "Additional"} Meal
          </Button>
          <Button
            variant={session.insulinMarked ? "danger" : "primary"}
            onClick={takeInsulin}
          >
            Take {session.insulinMarked && "Additional"} Insulin
          </Button>
        </div>
      </div>
    </>
  );
}
