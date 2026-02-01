import { Button, Form, InputGroup } from "react-bootstrap";
import Card from "../components/Card";
import {
  basalInsulinVariant,
  dosingChangeComplete,
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
    let strings: string[] = [];
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
    <>
      <Card>
        You take{" "}
        <b>
          {unitsPerDay}u {basalInsulinVariant.name}
        </b>{" "}
        in {shotsPerDay} injection(s) per day at:
        <br />
        {getTimes().map((s: string) => {
          return (
            <>
              {s}
              <br />
            </>
          );
        })}
        <hr />
        Previous doses (newest first):
        <br />
        {basals.map((a: Insulin, _: number) => {
          return (
            <>
              <b>{a.value}u</b> {`(${getPrettyTime(a.timestamp)})`}
              <br />
            </>
          );
        })}
        <hr />
        Last dose taken at {getPrettyTime(lastBasalTimestamp)},{" "}
        {getHoursSince(lastBasalTimestamp)} hours ago
      </Card>
      <Card>
        You fasting blood glucose rate is around{" "}
        <b>
          {fastingVelocity > 0 && "+"}
          {round(fastingVelocity, 0)}mg/dL per hour
        </b>
        <br />
        Collected <b>{fastingTime.toFixed(1)} hours</b> of fasting
        <hr />
        {changeIsComplete
          ? `Current dosing cycle is complete`
          : `Current dosing cycle is not complete`}
      </Card>
      <Card>
        <InputGroup className="mb-3">
          <InputGroup.Text id="basic-addon1">
            <i className="bi bi-eyedropper"></i>
          </InputGroup.Text>
          <Form.Control
            placeholder={`${lastShot.toString()}`}
            aria-label="URL"
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
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button
            variant="outline-primary"
            style={{ minWidth: "120px" }}
            onClick={() => markBasalInjection(lastShot)}
          >
            {lastShot}u
          </Button>
        </div>
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={onMark}>
          Mark Basal
        </Button>
      </div>
    </>
  );
}
