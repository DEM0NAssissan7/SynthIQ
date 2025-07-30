import { Button, Form, InputGroup } from "react-bootstrap";
import Card from "../components/Card";
import {
  getBasals,
  getFastingVelocity,
  getLastBasalTimestamp,
  markBasal,
} from "../lib/basal";
import { getBasalCorrection } from "../lib/metabolism";
import { round } from "../lib/util";
import { useState } from "react";
import { useNavigate } from "react-router";
import { getHourDiff, getPrettyTime } from "../lib/timing";
import healthMonitorStore from "../storage/healthMonitorStore";

export default function BasalPage() {
  const fastingVelocity = getFastingVelocity();
  const basalCorrection = round(getBasalCorrection(fastingVelocity), 0);
  const shotsPerDay = healthMonitorStore.get("basalShotsPerDay");
  const basalCorrectionPerDay = round(basalCorrection / shotsPerDay, 1);
  const basals = getBasals();
  const lastBasalTimestamp = getLastBasalTimestamp();

  const suggestedBasal = basals[basals.length - shotsPerDay] || 0;
  const [basalDose, setBasalDose] = useState(0);

  const navigate = useNavigate();
  function markBasalInjection() {
    if (
      confirm(`Confirm that you have injected ${basalDose}u of basal insulin`)
    ) {
      markBasal(basalDose);
      navigate("/");
    }
  }

  const firstShotHour = healthMonitorStore.get("basalShotTime"); // 8 => 8:00 AM, 16 => 4:00 PM
  const interval = 24 / shotsPerDay;
  function getTimes() {
    let strings: string[] = [];
    for (let i = 0; i < shotsPerDay; i++) {
      const hour = firstShotHour + i * interval;
      const suffix = hour < 12 ? "AM" : "PM";
      strings.push(`${hour % 12}:00 ${suffix}`);
    }
    return strings;
  }

  function getHoursSince(timestamp: Date) {
    return round(getHourDiff(new Date(), timestamp), 0);
  }

  return (
    <>
      <Card>
        You take {shotsPerDay} basal injection(s) per day at:
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
        Previous Doses:
        <br />
        <b>
          {basals.map((a: number) => {
            return (
              <>
                {a}u<br />
              </>
            );
          })}
        </b>
        <hr />
        Last dose taken at {getPrettyTime(lastBasalTimestamp)},{" "}
        {getHoursSince(lastBasalTimestamp)} hours ago
      </Card>
      <Card>
        You fasting glucose rise rate is {round(fastingVelocity, 0)}mg/dL per
        hour
        <br />
        {Math.abs(basalCorrection) > 0.5 && (
          <>
            Consider raising the dosage by <b>{basalCorrection}u per day</b>{" "}
            <i>{shotsPerDay > 1 && `(${basalCorrectionPerDay}u per shot)`}</i>
          </>
        )}
      </Card>
      <Card>
        <InputGroup className="mb-3">
          <InputGroup.Text id="basic-addon1">
            <i className="bi bi-eyedropper"></i>
          </InputGroup.Text>
          <Form.Control
            placeholder={`${suggestedBasal.toString()}`}
            aria-label="URL"
            aria-describedby="basic-addon1"
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setBasalDose(val);
              else setBasalDose(0);
            }}
          />
          <InputGroup.Text id="basic-addon1">u</InputGroup.Text>
        </InputGroup>
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={markBasalInjection}>
          Mark Basal
        </Button>
      </div>
    </>
  );
}
