import { Alert, Button, Card as BsCard } from "react-bootstrap";
import { Link } from "react-router";
import { basalIsDue, getLatestBolus } from "../lib/healthMonitor";
import { WizardStore } from "../storage/wizardStore";
import { InsulinExpirationManager } from "../managers/expirationManager";
import { useNow } from "../state/useNow";
import {
  ActionCard,
  ActionGrid,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";
import LastBolusMessage from "../components/LastBolusMessage";
import SessionHubContent from "../components/SessionHubContent";
import BasalCard from "../components/BasalCard";
import { useMemo, useState } from "react";

function QuickTreatmentsContent() {
  const latestBolus = getLatestBolus();
  const expiredInsulins = InsulinExpirationManager.getExpired();

  return (
    <>
      {expiredInsulins.length > 0 && (
        <Alert
          variant="warning"
          className="border-0 shadow-sm d-flex align-items-start gap-3 mb-3"
        >
          <i className="bi bi-exclamation-triangle-fill fs-4 flex-shrink-0" />
          <div className="flex-grow-1">
            <div className="fw-semibold mb-1">
              Insulin expiration needs attention
            </div>
            <div className="small mb-2">
              {expiredInsulins.map((insulin) => insulin.fullName).join(", ")}
            </div>
            <Button
              variant="warning"
              className="fw-semibold"
              as={Link as any}
              to="/expirations"
            >
              View insulin expirations
            </Button>
          </div>
        </Alert>
      )}

      <ActionGrid>
        {latestBolus !== null && (
          <BsCard className="h-100 border-0 shadow-sm app-action-card mb-3">
            <BsCard.Body className="p-3">
              <LastBolusMessage />
            </BsCard.Body>
          </BsCard>
        )}
        <ActionCard
          icon="bi-droplet-half"
          eyebrow="Insulin"
          title="Insulin dosing"
          body="Open dosing quickly for corrections or a meal-related dose."
          to="/insulin"
          buttonLabel="Open insulin"
        />
        <ActionCard
          icon="bi-life-preserver"
          eyebrow="Rescue"
          title="Low correction"
          body="Jump straight to rescue corrections when you need them."
          to="/rescue"
          buttonLabel="Open rescue"
        />
      </ActionGrid>
      <br />

      <BsCard className="border-0 shadow-sm">
        <BsCard.Body className="p-3">
          <div className="small text-uppercase text-muted fw-semibold mb-1">
            Session
          </div>
          <h2 className="h5 mb-1">Meal session</h2>
          <p className="text-muted mb-3">
            Start a new session when you need meal planning and live guidance.
          </p>
          <div className="d-grid gap-2">
            <Button
              variant="dark"
              className="py-2 fw-semibold"
              as={Link as any}
              to="/wizard/select"
            >
              Start session
            </Button>
          </div>
        </BsCard.Body>
      </BsCard>
      <br />
    </>
  );
}

function HubPage() {
  const now = useNow(60);

  const [session] = WizardStore.session.useState();
  const sessionActive = session.started;

  const [dueForBasal, setDueForBasal] = useState(basalIsDue());
  useMemo(() => {
    setDueForBasal(basalIsDue());
  }, [now]);

  return (
    <PageLayout maxWidth="32rem">
      {dueForBasal && (
        <BasalCard dueForBasal={dueForBasal} setDueForBasal={setDueForBasal} />
      )}
      {sessionActive ? (
        <>
          <PageHeader
            eyebrow="Wizard"
            title="Session hub"
            subtitle="Keep the current session readable while keeping glucose, activity, meal, and insulin actions close at hand."
          />
          <SessionHubContent />
        </>
      ) : (
        <>
          <PageHeader eyebrow="Hub" title="Quick treatments" />
          <QuickTreatmentsContent />
        </>
      )}
      {!dueForBasal && (
        <BasalCard dueForBasal={dueForBasal} setDueForBasal={setDueForBasal} />
      )}
    </PageLayout>
  );
}

export default HubPage;
