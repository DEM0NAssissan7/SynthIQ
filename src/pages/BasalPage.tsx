import { Button, Form, InputGroup } from "react-bootstrap";
import Card from "../components/Card";
import {
  MetricGrid,
  MetricPill,
  PageActions,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";
import {
  basalInsulinVariant,
  dosingChangeComplete,
  getBasalSensitivity,
  getDailyBasal,
  getFastingLength,
  getFastingVelocity,
  getLastShot,
  populateFastingVelocitiesCache,
} from "../lib/basal";
import { round } from "../lib/util";
import { useEffect, useMemo, useReducer, useState } from "react";
import { useNavigate } from "react-router";
import { getHourDiff, getPrettyTime } from "../lib/timing";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { BasalStore } from "../storage/basalStore";
import { getLatestBasalTimestamp } from "../lib/healthMonitor";
import type Insulin from "../models/events/insulin";
import { useNow } from "../state/useNow";
import { TreatmentManager } from "../managers/treatmentManager";

export default function BasalPage() {
  const now = useNow(60);
  const [updated, incrementUpdate] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    populateFastingVelocitiesCache().then(() => incrementUpdate());
  }, [now]);
  const fastingVelocity = useMemo(() => getFastingVelocity(), [updated]);
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const unitsPerDay = getDailyBasal();
  const basals = BasalStore.basalDoses.value;
  const lastBasalTimestamp = getLatestBasalTimestamp();
  const fastingTime = getFastingLength();
  const liverOutput = BasalStore.estimatedLiverOutput.value;
  const sensitivityIndex = liverOutput
    ? getBasalSensitivity(liverOutput, fastingVelocity, unitsPerDay)
    : null;

  const lastShot = getLastShot();
  const changeIsComplete = dosingChangeComplete();
  const [basalDose, setBasalDose] = useState(0);

  const navigate = useNavigate();
  function markBasalInjection(dose: number) {
    if (confirm(`Confirm that you have injected ${dose}u of basal insulin`)) {
      TreatmentManager.basal(dose, new Date());
      navigate("/");
    }
  }
  function onMark() {
    markBasalInjection(basalDose);
  }

  const firstShotHour = HealthMonitorStore.basalShotTime.value; // 8 => 8:00 AM, 16 => 4:00 PM
  const interval = 24 / shotsPerDay;
  function getTimes() {
    const strings: string[] = [];
    for (let i = 0; i < shotsPerDay; i++) {
      const hour = firstShotHour + i * interval;
      const suffix = hour < 12 || hour === 24 ? "AM" : "PM";
      strings.push(`${hour % 12 || 12}:00 ${suffix}`);
    }
    return strings;
  }

  function getHoursSince(timestamp: Date) {
    return round(getHourDiff(now, timestamp), 0);
  }

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Treatment"
        title="Basal injection"
        subtitle="Keep schedule, recent history, and quick marking in one focused place."
      />

      <Card>
        <MetricGrid>
          <MetricPill
            label="Daily total"
            value={`${unitsPerDay.toFixed(1)}u ${basalInsulinVariant.name}`}
          />
          <MetricPill label="Shots per day" value={shotsPerDay} />
          <MetricPill
            label="Last dose"
            value={`${getPrettyTime(lastBasalTimestamp)} (${getHoursSince(
              lastBasalTimestamp,
            )}h ago)`}
          />
          <MetricPill label="Cycle status" value={changeIsComplete ? "Complete" : "In progress"} />
        </MetricGrid>
        <hr />
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Schedule
        </div>
        <div className="d-flex flex-wrap gap-2">
          {getTimes().map((time) => (
            <span key={time} className="badge text-bg-light border px-3 py-2">
              {time}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Basal analysis
        </div>
        <MetricGrid>
          <MetricPill
            label="Fasting velocity"
            value={`${fastingVelocity > 0 ? "+" : ""}${round(
              fastingVelocity,
              0,
            )} mg/dL/hr`}
          />
          <MetricPill
            label="Fasting data"
            value={`${fastingTime.toFixed(1)} hours`}
          />
          {liverOutput !== null && sensitivityIndex !== null && (
            <>
              <MetricPill
                label="Liver output"
                value={`${liverOutput.toFixed(1)} mg/dL/hr`}
              />
              <MetricPill
                label="Sensitivity"
                value={`${(sensitivityIndex / 42).toFixed(1)} mg/dL/hr/U`}
              />
            </>
          )}
        </MetricGrid>
      </Card>

      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Quick mark
        </div>
        <InputGroup className="mb-3">
          <InputGroup.Text id="basic-addon1">
            <i className="bi bi-eyedropper"></i>
          </InputGroup.Text>
          <Form.Control
            placeholder={lastShot.toString()}
            aria-label="Basal dose"
            type="number"
            aria-describedby="basic-addon1"
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setBasalDose(val);
              else setBasalDose(0);
            }}
          />
          <InputGroup.Text id="basic-addon1">u</InputGroup.Text>
        </InputGroup>
        <PageActions inline>
          <Button
            variant="outline-primary"
            onClick={() => markBasalInjection(lastShot)}
          >
            {lastShot}u
          </Button>
          <Button variant="primary" onClick={onMark}>
            Mark basal
          </Button>
        </PageActions>
      </Card>

      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Previous doses
        </div>
        <div className="small">
          {basals.map((a: Insulin, index: number) => (
            <div
              key={`${a.timestamp.getTime()}-${index}`}
              className="d-flex justify-content-between py-2 border-bottom"
            >
              <span className="fw-semibold">{a.value}u</span>
              <span className="text-muted">{getPrettyTime(a.timestamp)}</span>
            </div>
          ))}
        </div>
      </Card>
    </PageLayout>
  );
}
