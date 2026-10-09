import { basalIsDue } from "../lib/healthMonitor";
import { useNow } from "../state/useNow";
import { ActionCard, PageLayout } from "../components/PageLayout";
import BasalCard from "../components/BasalCard";
import { useEffect, useState } from "react";
import { ToggleButton } from "react-bootstrap";
import LastBolusMessage from "../components/LastBolusMessage";
import SessionSummary from "../components/summary/SessionSummary";
import { WizardStore } from "../storage/wizardStore";
import Card from "../components/Card";
import { useNavigate } from "react-router";
import MdIcon from "../components/md3/MdIcon";
import PredictedGlucoseCard from "../components/PredictedGlucoseCard";

function HubPage() {
  const now = useNow(60);
  const [session] = WizardStore.session.useState();
  const [activeTemplate] = WizardStore.activeTemplate.useState();

  const navigate = useNavigate();

  const [dueForBasal, setDueForBasal] = useState(basalIsDue());
  useEffect(() => {
    setDueForBasal(basalIsDue());
  }, [now]);
  function editSession() {
    navigate("/session/edit");
  }
  function setGarbage(value: boolean) {
    if (value === true) {
      if (confirm("Do you want to mark this session as unreliable?")) {
        session.isGarbage = value;
        WizardStore.session.write();
      }
    } else {
      session.isGarbage = value;
      WizardStore.session.write();
    }
  }

  return (
    <PageLayout maxWidth="34rem">
      <PredictedGlucoseCard />

      {dueForBasal && (
        <BasalCard dueForBasal={dueForBasal} setDueForBasal={setDueForBasal} />
      )}

      <Card>
        <div className="app-card-title">
          <MdIcon
            name="water_drop"
            fill
            className="text-primary"
            size={20}
          />
          <span>Active insulin</span>
        </div>
        <LastBolusMessage />
      </Card>

      {session.started && (
        <SessionSummary
          session={session}
          template={activeTemplate}
          contained={true}
        />
      )}

      {!dueForBasal && (
        <BasalCard dueForBasal={dueForBasal} setDueForBasal={setDueForBasal} />
      )}

      {session.started && (
        <Card>
          <div className="app-card-title">
            <MdIcon
              name="tune"
              className="text-secondary"
              size={20}
            />
            <span>Session controls</span>
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
              icon="edit_note"
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
    </PageLayout>
  );
}

export default HubPage;
