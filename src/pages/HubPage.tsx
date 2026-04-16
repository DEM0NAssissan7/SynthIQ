import { Alert, Badge, Button, Card } from "react-bootstrap";
import { Link, useNavigate } from "react-router";
import { basalIsDue } from "../lib/healthMonitor";
import { getDailyBasalPerShot, getLastShot } from "../lib/basal";
import { getHourDiff, getPrettyTime } from "../lib/timing";
import { round } from "../lib/util";
import { WizardStore } from "../storage/wizardStore";
import { BasalStore } from "../storage/basalStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { TreatmentManager } from "../managers/treatmentManager";
import { InsulinExpirationManager } from "../managers/expirationManager";
import { useNow } from "../state/useNow";
import {
  ActionCard,
  ActionGrid,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";

function formatDose(value: number) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

interface BasalCardProps {
  dueForBasal: boolean;
}
function BasalCard({ dueForBasal }: BasalCardProps) {
  const navigate = useNavigate();

  const [firstShotHour] = HealthMonitorStore.basalShotTime.useState();
  const [basalDoses] = BasalStore.basalDoses.useState();
  const [shotsPerDay] = HealthMonitorStore.basalShotsPerDay.useState();

  const interval = 24 / shotsPerDay;
  const latestBasal = basalDoses[0] ?? null;
  const lastShot = getLastShot();
  const fallbackDose = getDailyBasalPerShot();
  const typicalBasalDose =
    lastShot > 0 ? lastShot : Number.isFinite(fallbackDose) ? fallbackDose : 0;
  const scheduledTimes = Array.from({ length: shotsPerDay }, (_, index) => {
    const hour = firstShotHour + index * interval;
    const normalizedHour = hour % 24 || 24;
    const suffix = normalizedHour < 12 || normalizedHour === 24 ? "AM" : "PM";
    return `${normalizedHour % 12 || 12}:00 ${suffix}`;
  });

  function markTypicalBasal() {
    if (typicalBasalDose <= 0) {
      navigate("/basal");
      return;
    }
    const doseLabel = formatDose(typicalBasalDose);
    if (
      confirm(`Confirm that you have injected ${doseLabel}u of basal insulin`)
    ) {
      TreatmentManager.basal(typicalBasalDose, new Date());
    }
  }

  return (
    <Card
      className={`border-0 shadow-sm mb-3 ${dueForBasal ? "bg-primary-subtle" : ""}`}
    >
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <div className="small text-uppercase text-muted fw-semibold mb-1">
              Basal
            </div>
            <p className="text-muted mb-0">
              {dueForBasal
                ? "Your basal looks due. Quick mark your usual dose or open the full basal page."
                : ""}
            </p>
          </div>
          <Badge bg={dueForBasal ? "primary" : "secondary"}>
            {dueForBasal ? "Due now" : "On schedule"}
          </Badge>
        </div>

        <div className="rounded-4 bg-white p-3 mb-3">
          <div className="d-flex justify-content-between gap-3 small">
            <div>
              <div className="text-muted">Typical dose</div>
              <div className="fw-semibold">
                {typicalBasalDose > 0
                  ? `${formatDose(typicalBasalDose)}u`
                  : "Open basal page"}
              </div>
            </div>
            <div className="text-end">
              <div className="text-muted">Schedule</div>
              <div className="fw-semibold">{scheduledTimes.join(" / ")}</div>
            </div>
          </div>
          <div className="small text-muted mt-2">
            {latestBasal
              ? `Last basal: ${formatDose(latestBasal.value)}u at ${getPrettyTime(
                  latestBasal.timestamp,
                )} (${round(getHourDiff(new Date(), latestBasal.timestamp), 1)}h ago)`
              : "No basal history yet."}
          </div>
        </div>

        <div className="d-grid gap-2">
          <Button
            variant={dueForBasal ? "primary" : "outline-primary"}
            className="py-3 fw-semibold"
            onClick={markTypicalBasal}
          >
            {typicalBasalDose > 0
              ? `Mark ${formatDose(typicalBasalDose)}u now`
              : "Open basal page"}
          </Button>
          <Button
            variant="light"
            className="py-2 fw-semibold border"
            as={Link as any}
            to="/basal"
          >
            Basal details
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

function HubPage() {
  useNow(60);

  const [session] = WizardStore.session.useState();

  const dueForBasal = basalIsDue();

  const expiredInsulins = InsulinExpirationManager.getExpired();

  return (
    <PageLayout maxWidth="32rem">
      <PageHeader eyebrow="Hub" title="Quick treatments" />

      {dueForBasal && <BasalCard dueForBasal={dueForBasal} />}
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
        <ActionCard
          icon="bi-life-preserver"
          eyebrow="Rescue"
          title="Low correction"
          body="Jump straight to rescue corrections when you need them."
          to="/rescue"
          buttonLabel="Open rescue"
        />
        <ActionCard
          icon="bi-droplet-half"
          eyebrow="Insulin"
          title="Insulin dosing"
          body="Open dosing quickly for corrections or a meal-related dose."
          to="/insulin"
          buttonLabel="Open insulin"
        />
      </ActionGrid>
      <br />

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-3">
          <div className="small text-uppercase text-muted fw-semibold mb-1">
            Session
          </div>
          <h2 className="h5 mb-1">
            {session.started ? "Session in progress" : "Meal session"}
          </h2>
          <p className="text-muted mb-3">
            {session.started
              ? "Resume your current session or review its details."
              : "Start a new session when you need meal planning and live guidance."}
          </p>
          <div className="d-grid gap-2">
            <Button
              variant="dark"
              className="py-2 fw-semibold"
              as={Link as any}
              to={session.started ? "/wizard" : "/wizard/select"}
            >
              {session.started ? "Resume session" : "Start session"}
            </Button>
          </div>
        </Card.Body>
      </Card>
      <br />

      {!dueForBasal && <BasalCard dueForBasal={dueForBasal} />}
    </PageLayout>
  );
}

export default HubPage;
