import { basalIsDue } from "../lib/healthMonitor";
import { useNow } from "../state/useNow";
import { ActionCard, PageHeader, PageLayout } from "../components/PageLayout";
import BasalCard from "../components/BasalCard";
import { useMemo, useState } from "react";
import { ToggleButton } from "react-bootstrap";
import LastBolusMessage from "../components/LastBolusMessage";
import SessionSummary from "../components/summary/SessionSummary";
import { WizardStore } from "../storage/wizardStore";
import Card from "../components/Card";
import { useNavigate } from "react-router";

function HubPage() {
  const now = useNow(60);
  const [session] = WizardStore.session.useState();
  const [activeTemplate] = WizardStore.activeTemplate.useState();

  const navigate = useNavigate();

  const [dueForBasal, setDueForBasal] = useState(basalIsDue());
  useMemo(() => {
    setDueForBasal(basalIsDue());
  }, [now]);
  function editSession() {
    navigate("/session/edit");
  }
  function setGarbage(value: boolean) {
    if (value === true) {
      if (confirm("Do you want to mark this session as unreliable?"))
        session.isGarbage = value;
    } else session.isGarbage = value;
  }

  return (
    <PageLayout maxWidth="34rem">
      <PageHeader
        eyebrow="Overview"
        title="Status Hub"
        subtitle="Real-time session monitoring, active insulin, and background basal status."
      />

      {dueForBasal && (
        <BasalCard dueForBasal={dueForBasal} setDueForBasal={setDueForBasal} />
      )}

      <Card>
        <div className="app-card-title">
          <i className="bi bi-droplet-fill text-primary" />
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
            <i className="bi bi-sliders text-secondary" />
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
    </PageLayout>
  );
}

export default HubPage;
