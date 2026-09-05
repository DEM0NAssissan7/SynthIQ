import { ToggleButton } from "react-bootstrap";
import { useNavigate } from "react-router";
import Card from "./Card";
import TemplateSummary from "./summary/TemplateSummary";
import LastBolusMessage from "./LastBolusMessage";
import { WizardStore } from "../storage/wizardStore";
import { ActionCard, ActionGrid } from "./PageLayout";
import WizardManager from "../managers/wizardManager";

export default function SessionHubContent() {
  const navigate = useNavigate();
  const [session] = WizardStore.session.useState();
  const [activeTemplate] = WizardStore.activeTemplate.useState();
  const [meal] = WizardStore.meal.useState();
  console.log(meal);
  const shouldTransition = WizardManager.shouldTransitionSession();

  function setGarbage(value: boolean) {
    if (value === true) {
      if (confirm("Do you want to mark this session as unreliable?"))
        session.isGarbage = value;
    } else session.isGarbage = value;
  }

  const isSessionActive =
    session.started && !session.completed && !session.readyToTransition;
  const markedAndActive = session.insulinMarked && isSessionActive;
  function takeInsulin() {
    navigate("/markinsulin");
  }
  function addMeal() {
    navigate(meal.isEmpty ? "/selectmeal" : "/meal");
  }
  function takeGlucose() {
    navigate("/rescue");
  }
  function doActivity() {
    navigate("/activity");
  }
  function editSession() {
    navigate("/session/edit");
  }

  return (
    <>
      {session.started && (
        <Card>
          <TemplateSummary session={session} template={activeTemplate} />
        </Card>
      )}

      <Card className="mt-4">
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Active insulin
        </div>
        <LastBolusMessage />
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
          title={markedAndActive ? "Add more insulin" : "Mark insulin"}
          body={
            markedAndActive
              ? "Record an additional insulin dose without interrupting the current session."
              : "Open insulin dosing for the session."
          }
          buttonLabel={markedAndActive ? "Add insulin" : "Open insulin"}
          buttonVariant={markedAndActive ? "danger" : "primary"}
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
          icon="bi-fork-knife"
          eyebrow="Meal"
          title={shouldTransition ? "New Meal" : "Add Meal"}
          body={"Build and mark a new meal"}
          buttonLabel={
            meal.isEmpty
              ? shouldTransition
                ? "New meal"
                : "Add meal"
              : "Open Meal"
          }
          buttonVariant={session.immature ? "danger" : "primary"}
          onClick={addMeal}
        />
      </ActionGrid>

      {session.started && (
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
            <ActionCard
              icon="bi-pencil-square"
              eyebrow="Edit"
              title="Edit session"
              body="Adjust stored foods, treatments, or glucose details for the current session."
              buttonLabel="Open editor"
              buttonVariant="secondary"
              onClick={editSession}
            />
          </div>
        </Card>
      )}
    </>
  );
}
