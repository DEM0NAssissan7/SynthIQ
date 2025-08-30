import { useState, useMemo, useEffect } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import { useNavigate } from "react-router";
import BloodSugarInput from "../components/BloodSugarInput";
import {
  getGlucoseCorrectionCaps,
  getIntelligentGlucoseCorrection,
} from "../lib/metabolism";
import { round } from "../lib/util";
import WizardManager from "../managers/wizardManager";
import Card from "../components/Card";
import GlucoseSuggestion from "../components/GlucoseSuggestion";
import HealthMonitorMessage from "../components/HealthMonitorMessage";
import {
  populateReadingCache,
  getBGVelocity,
  markGlucose,
} from "../lib/healthMonitor";
import TemplateSummary from "../components/TemplateSummary";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { WizardStore } from "../storage/wizardStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { ActivityManager } from "../managers/activityManager";
import RemoteTreatments from "../lib/remote/treatments";

export default function RescuePage() {
  const [session] = WizardStore.session.useState();
  const [template] = WizardStore.template.useState();

  const [currentBG, setCurrentBG] = useState(
    session.initialGlucose
      ? session.initialGlucose
      : PreferencesStore.targetBG.value
  );
  const [gramsTaken, setCapsTaken] = useState(0);

  const correction = useMemo(() => {
    return round(getGlucoseCorrectionCaps(currentBG), 1);
  }, [currentBG]);
  const [intelligentCorrection, setIntelligentCorrection] = useState(0);

  useEffect(() => {
    populateReadingCache().then(() => {
      const velocityHours = getBGVelocity();
      const actingMinutes = HealthMonitorStore.dropTime.value;

      setIntelligentCorrection(
        getIntelligentGlucoseCorrection(velocityHours, currentBG, actingMinutes)
      );
    });
  }, [currentBG]);

  const navigate = useNavigate();
  function goBack() {
    navigate("/");
  }
  function confirmGlucose() {
    if (confirm(`Confirm that you have taken ${gramsTaken} grams of glucose`)) {
      WizardManager.markGlucose(gramsTaken);
      markGlucose(gramsTaken);
      ActivityManager.markGlucose(gramsTaken);
      RemoteTreatments.markGlucose(gramsTaken, new Date());
      goBack();
    }
  }

  return (
    <>
      <h1>Glucose Correction</h1>
      {session.started && (
        <Card>
          <TemplateSummary template={template} session={session} />
        </Card>
      )}
      <Card>
        <GlucoseSuggestion
          intelligentCorrection={intelligentCorrection}
          baseCorrection={correction}
        />
        <hr />
        <HealthMonitorMessage />
      </Card>
      <Card>
        <BloodSugarInput
          initialGlucose={currentBG}
          setInitialGlucose={setCurrentBG}
          pullFromNightscout={true}
        />
        <InputGroup className="mb-3">
          <InputGroup.Text id="basic-addon1">
            <i className="bi bi-capsule"></i>
          </InputGroup.Text>
          <Form.Control
            type="number"
            placeholder={round(intelligentCorrection, 1).toString()}
            aria-describedby="basic-addon1"
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setCapsTaken(val);
              else setCapsTaken(0);
            }}
          />
          <InputGroup.Text id="basic-addon1">caps</InputGroup.Text>
        </InputGroup>
      </Card>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {session.started && (
          <Button variant="secondary" onClick={goBack}>
            Go To Wizard
          </Button>
        )}
        <div style={{ marginLeft: "auto" }}>
          <Button variant="primary" onClick={confirmGlucose}>
            Mark Glucose
          </Button>
        </div>
      </div>
    </>
  );
}
