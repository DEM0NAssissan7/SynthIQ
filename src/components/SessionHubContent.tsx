import { Button, ToggleButton } from "react-bootstrap";
import { useNavigate } from "react-router";
import Card from "./Card";
import TemplateSummary from "./TemplateSummary";
import LastBolusMessage from "./LastBolusMessage";
import { WizardStore } from "../storage/wizardStore";
import WizardManager from "../managers/wizardManager";
import { WizardPage } from "../models/types/wizardPage";
import {
  ActionCard,
  ActionGrid,
} from "./PageLayout";

export default function SessionHubContent() {
  const navigate = useNavigate();
  const [session] = WizardStore.session.useState();
  const [template] = WizardStore.template.useState();

  function setGarbage(value: boolean) {
    if (value === true) {
      if (confirm("Do you want to mark this session as unreliable?"))
        session.isGarbage = value;
    } else session.isGarbage = value;
  }

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
  function doActivity() {
    navigate("/activity");
  }
  function editSession() {
    WizardManager.moveToPage(WizardPage.Edit, navigate);
  }
  function cancelSession() {
    WizardManager.cancelSession(navigate);
  }

  return (
    <>
      <Card>
        <TemplateSummary session={session} template={template} />
      </Card>

      <ActionGrid>
        <ActionCard
          icon="bi-life-preserver"
          eyebrow="Rescue"
          title="Take glucose"
          body="Jump straight to rescue treatment without leaving the session context behind."
          buttonLabel="Open rescue"
          onClick={takeGlucose}
        />
        <ActionCard
          icon="bi-droplet-half"
          eyebrow="Insulin"
          title={session.insulinMarked ? "Add more insulin" : "Mark insulin"}
          body={
            session.insulinMarked
              ? "Record an additional insulin dose without interrupting the current session."
              : "Open insulin dosing for the session."
          }
          buttonLabel={session.insulinMarked ? "Add insulin" : "Open insulin"}
          buttonVariant={session.insulinMarked ? "danger" : "primary"}
          onClick={takeInsulin}
        />
        <ActionCard
          icon="bi-person-walking"
          eyebrow="Activity"
          title="Start activity"
          body="Log an activity alongside the session so the effects stay captured together."
          buttonLabel="Open activity"
          onClick={doActivity}
        />
        <ActionCard
          icon="bi-pencil-square"
          eyebrow="Edit"
          title="Edit session"
          body="Adjust stored foods, treatments, or glucose details for the current session."
          buttonLabel="Open editor"
          buttonVariant="secondary"
          onClick={editSession}
        />
        <ActionCard
          icon="bi-fork-knife"
          eyebrow="Meal"
          title={session.mealMarked ? "Add another meal" : "Mark meal"}
          body={
            session.mealMarked
              ? "Add another meal event while keeping the existing session running."
              : "Build and mark the meal for this session."
          }
          buttonLabel={session.mealMarked ? "Add meal" : "Open meal"}
          buttonVariant={session.mealMarked ? "danger" : "primary"}
          onClick={addMeal}
        />
        <ActionCard
          icon="bi-check2-circle"
          eyebrow="Finish"
          title="End session"
          body="Wrap up the session with a final blood sugar and save the result."
          buttonLabel="Finish session"
          buttonVariant="secondary"
          onClick={startNew}
        />
      </ActionGrid>

      <Card className="mt-4">
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Active insulin
        </div>
        <LastBolusMessage />
      </Card>

      <Card className="mt-4">
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Session controls
        </div>
        <div className="d-grid gap-2">
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
          <Button variant="danger" onClick={cancelSession}>
            Cancel Session
          </Button>
        </div>
      </Card>
    </>
  );
}
