import { useState, useMemo, useEffect } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import { useNavigate } from "react-router";
import BloodSugarInput from "../components/BloodSugarInput";
import {
  getGlucoseCorrectionCaps,
  getIntelligentGlucoseCorrection,
} from "../lib/metabolism";
import { roundByHalf } from "../lib/util";
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
import { NumberOptionSelector } from "../components/NumberOptionSelector";

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
    return roundByHalf(getGlucoseCorrectionCaps(currentBG), true);
  }, [currentBG]);
  const [intelligentCorrection, setIntelligentCorrection] = useState(0);

  useEffect(() => {
    populateReadingCache().then(() => {
      const velocityHours = getBGVelocity();
      const actingMinutes = HealthMonitorStore.dropTime.value;

      setIntelligentCorrection(
        roundByHalf(
          getIntelligentGlucoseCorrection(
            velocityHours,
            currentBG,
            actingMinutes
          ),
          true
        )
      );
    });
  }, [currentBG]);

  const navigate = useNavigate();
  function goBack() {
    navigate("/");
  }
  function markGlucoseTaken(grams: number) {
    if (confirm(`Confirm that you have taken ${grams} grams of glucose`)) {
      WizardManager.markGlucose(grams);
      markGlucose(grams);
      ActivityManager.markGlucose(grams);
      RemoteTreatments.markGlucose(grams, new Date());
      goBack();
    }
  }
  function onMark() {
    markGlucoseTaken(gramsTaken);
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
            placeholder={intelligentCorrection.toString()}
            aria-describedby="basic-addon1"
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setCapsTaken(val);
              else setCapsTaken(0);
            }}
          />
          <InputGroup.Text id="basic-addon1">caps</InputGroup.Text>
        </InputGroup>
        <div className="d-flex justify-content-center flex-wrap">
          <NumberOptionSelector
            value={intelligentCorrection}
            rangeFromOrigin={2}
            increment={0.5}
            labelSuffix="g"
            onSelect={(val) => {
              markGlucoseTaken(val);
            }}
          />
        </div>
      </Card>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {session.started && (
          <Button variant="secondary" onClick={goBack}>
            Go To Wizard
          </Button>
        )}
        <div style={{ marginLeft: "auto" }}>
          <Button variant="primary" onClick={onMark}>
            Mark Glucose
          </Button>
        </div>
      </div>
    </>
  );
}
