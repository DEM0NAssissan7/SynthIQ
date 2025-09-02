import { Button, Form, InputGroup } from "react-bootstrap";
import Card from "../components/Card";
import {
  dosingChangeComplete,
  getFastingLength,
  getFastingVelocity,
  getLastShot,
  getRecommendedBasal,
  markBasal,
} from "../lib/basal";
import { getBasalCorrection } from "../lib/metabolism";
import { round } from "../lib/util";
import { useState } from "react";
import { useNavigate } from "react-router";
import { getHourDiff, getPrettyTime } from "../lib/timing";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { BasalStore } from "../storage/basalStore";
import { getLatestBasalTimestamp } from "../lib/healthMonitor";
import type Insulin from "../models/events/insulin";

export default function BasalPage() {
  const fastingVelocity = getFastingVelocity();
  const basalCorrection = round(getBasalCorrection(fastingVelocity), 0);
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const basalCorrectionPerDay = round(basalCorrection / shotsPerDay, 1);
  const basals = BasalStore.basalDoses.value;
  const lastBasalTimestamp = getLatestBasalTimestamp();
  const fastingTime = getFastingLength();

  const suggestedBasal = getRecommendedBasal();
  const lastShot = getLastShot();
  const changeIsComplete = dosingChangeComplete();
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
        <br />
        {Math.abs(basalCorrection) > 1 && changeIsComplete && (
          <>
            Consider adjusting dosage to <b>{suggestedBasal}u per shot</b>{" "}
            <i>
              {shotsPerDay > 1 &&
                `(${
                  basalCorrectionPerDay > 0 ? "+" : ""
                }${basalCorrectionPerDay}u per shot)`}
            </i>
          </>
        )}
        <hr />
        {changeIsComplete
          ? `Your current dosing cycle is complete`
          : `Your current dosing cycle is not complete`}
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
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={markBasalInjection}>
          Mark Basal
        </Button>
      </div>
    </>
  );
}
