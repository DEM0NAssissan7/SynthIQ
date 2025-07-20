import { useState, useMemo, useEffect } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import { useNavigate } from "react-router";
import BloodSugarInput from "../components/BloodSugarInput";
import TemplateSessionSummary from "../components/TemplateSessionSummary";
import {
  getGlucoseCorrectionCaps,
  getIntelligentGlucoseCorrection,
} from "../lib/metabolism";
import TemplateManager from "../lib/templateManager";
import { round } from "../lib/util";
import WizardManager from "../lib/wizardManager";
import { useWizardSession } from "../state/useSession";
import Card from "../components/Card";
import GlucoseSuggestion from "../components/GlucoseSuggestion";
import HealthMonitorMessage from "../components/HealthMonitorMessage";
import { populateReadingCache, getBGVelocity } from "../lib/healthMonitor";
import healthMonitorStore from "../storage/healthMonitorStore";

export default function RescuePage() {
  const session = useWizardSession();
  const template = TemplateManager.getTemplate();

  const [currentBG, setCurrentBG] = useState(session.initialGlucose);
  const [capsTaken, setCapsTaken] = useState(0);

  const correction = useMemo(() => {
    return round(getGlucoseCorrectionCaps(currentBG), 1);
  }, [currentBG]);
  const [intelligentCorrection, setIntelligentCorrection] = useState(0);

  useEffect(() => {
    populateReadingCache().then(() => {
      const velocityHours = getBGVelocity();
      const actingMinutes = healthMonitorStore.get("dropTime");

      setIntelligentCorrection(
        getIntelligentGlucoseCorrection(velocityHours, currentBG, actingMinutes)
      );
    });
  }, [currentBG]);

  const navigate = useNavigate();
  function goBack() {
    WizardManager.moveToCurrentPage(navigate);
  }
  function markGlucose() {
    if (
      confirm(`Confirm that you have taken ${capsTaken} caps/grams of glucose`)
    ) {
      WizardManager.markGlucose(capsTaken);
      goBack();
    }
  }

  return (
    <>
      <h1>Glucose Correction</h1>
      {WizardManager.isActive() && (
        <Card>
          <TemplateSessionSummary template={template} session={session} />
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
        />
        <InputGroup className="mb-3">
          <InputGroup.Text id="basic-addon1">
            <i className="bi bi-capsule"></i>
          </InputGroup.Text>
          <Form.Control
            placeholder={intelligentCorrection.toString()}
            aria-label="URL"
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
        {WizardManager.isActive() && (
          <Button variant="secondary" onClick={goBack}>
            Go To Wizard
          </Button>
        )}
        <div style={{ marginLeft: "auto" }}>
          <Button variant="primary" onClick={markGlucose}>
            Mark Glucose
          </Button>
        </div>
      </div>
    </>
  );
}
