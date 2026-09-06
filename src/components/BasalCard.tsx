import { Button } from "react-bootstrap";
import { useNavigate, Link } from "react-router";
import { getLastShot, getDailyBasalPerShot } from "../lib/basal";
import { getPrettyTime, getHourDiff } from "../lib/timing";
import { round } from "../lib/util";
import { BasalStore } from "../storage/basalStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import WizardManager from "../managers/wizardManager";
import Card from "./Card";

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
      WizardManager.markBasal(typicalBasalDose, new Date());
      setDueForBasal(false);
    }
  }

  return (
    <Card>
      <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
        <div>
          <div className="app-card-title mb-1">
            <i className="bi bi-shield-check text-success" />
            <span>Basal Status</span>
          </div>
          {dueForBasal && (
            <p className="text-muted small mb-0">
              Your basal looks due. Quick mark your usual dose or view schedule.
            </p>
          )}
        </div>
        <span
          className={`badge ${
            dueForBasal
              ? "bg-warning-subtle text-warning-emphasis"
              : "bg-success-subtle text-success"
          } fw-semibold px-2 py-0.5 rounded-pill`}
          style={{ fontSize: "0.72rem" }}
        >
          {dueForBasal ? "Due now" : "On schedule"}
        </span>
      </div>

      <div className="app-stat-strip mb-3">
        <div className="app-stat-strip-item">
          <span className="stat-label">Typical Dose</span>
          <span className="stat-value">
            {typicalBasalDose > 0
              ? `${formatDose(typicalBasalDose)}u`
              : "Not set"}
          </span>
        </div>
        <div className="app-stat-strip-item">
          <span className="stat-label">Schedule</span>
          <span className="stat-value">{scheduledTimes.join(" / ")}</span>
        </div>
        <div className="app-stat-strip-item" style={{ gridColumn: "span 2" }}>
          <span className="stat-label">Last Dose</span>
          <span className="stat-value">
            {latestBasal
              ? `${formatDose(latestBasal.value)}u · ${getPrettyTime(
                  latestBasal.timestamp,
                )} (${round(getHourDiff(new Date(), latestBasal.timestamp), 1)}h ago)`
              : "None yet"}
          </span>
        </div>
      </div>

      <div className="d-grid gap-2">
        <Button
          variant={dueForBasal ? "primary" : "outline-primary"}
          onClick={markTypicalBasal}
        >
          {typicalBasalDose > 0
            ? `Mark ${formatDose(typicalBasalDose)}u now`
            : "Open basal page"}
        </Button>
        <Button
          variant="outline-secondary"
          as={Link as any}
          to="/basal"
        >
          Basal details
        </Button>
      </div>
    </Card>
  );
}
