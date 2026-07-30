import { Badge, Button, Card as BsCard } from "react-bootstrap";
import { useNavigate, Link } from "react-router";
import { getLastShot, getDailyBasalPerShot } from "../lib/basal";
import { getPrettyTime, getHourDiff } from "../lib/timing";
import { round } from "../lib/util";
import { TreatmentManager } from "../managers/treatmentManager";
import { BasalStore } from "../storage/basalStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";

function formatDose(value: number) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

interface BasalCardProps {
  dueForBasal: boolean;
  setDueForBasal: (due: boolean) => void;
}
export default function BasalCard({
  dueForBasal,
  setDueForBasal,
}: BasalCardProps) {
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
      setDueForBasal(false);
    }
  }

  return (
    <BsCard
      className={`border-0 shadow-sm mb-3 ${dueForBasal ? "bg-primary-subtle" : ""}`}
    >
      <BsCard.Body className="p-3">
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
      </BsCard.Body>
    </BsCard>
  );
}
