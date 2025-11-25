import { useState, useMemo, useEffect, useReducer } from "react";
import {
  Button,
  Form,
  InputGroup,
  ListGroup,
  ToggleButton,
} from "react-bootstrap";
import { useNavigate } from "react-router";
import BloodSugarInput from "../components/BloodSugarInput";
import {
  getGlucoseCorrectionCaps,
  getIntelligentGlucoseCorrection,
} from "../lib/metabolism";
import { roundByHalf } from "../lib/util";
import Card from "../components/Card";
import GlucoseSuggestion from "../components/GlucoseSuggestion";
import HealthMonitorMessage from "../components/HealthMonitorMessage";
import { populateReadingCache, getBGVelocity } from "../lib/healthMonitor";
import TemplateSummary from "../components/TemplateSummary";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { WizardStore } from "../storage/wizardStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { NumberOptionSelector } from "../components/NumberOptionSelector";
import { RescueVariantManager } from "../managers/rescueVariantManager";
import type { RescueVariant } from "../models/types/rescueVariant";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import { useNow } from "../state/useNow";
import { TreatmentManager } from "../managers/treatmentManager";

export default function RescuePage() {
  const [session] = WizardStore.session.useState();
  const [template] = WizardStore.template.useState();

  const [currentBG, setCurrentBG] = useState(
    session.initialGlucose
      ? session.initialGlucose
      : PreferencesStore.targetBG.value
  );
  const [gramsTaken, setCapsTaken] = useState(0);
  const [variant, setVariant] = useState(RescueVariantManager.getDefault());

  const correction = useMemo(() => {
    return roundByHalf(getGlucoseCorrectionCaps(currentBG, variant), true);
  }, [currentBG, variant]);
  const [intelligentCorrection, setIntelligentCorrection] = useState(0);

  const now = useNow();
  const [updated, update] = useReducer((a) => a + 1, 0);
  useEffect(() => {
    populateReadingCache().then(update);
  }, [now]);
  useEffect(() => {
    populateReadingCache().then(() => {
      const velocityHours = getBGVelocity();
      const actingMinutes = HealthMonitorStore.dropTime.value;

      setIntelligentCorrection(
        roundByHalf(
          getIntelligentGlucoseCorrection(
            velocityHours,
            currentBG,
            actingMinutes,
            variant
          ),
          true
        )
      );
    });
  }, [currentBG, variant, updated]);

  const navigate = useNavigate();
  function goBack() {
    navigate("/");
  }
  function markGlucoseTaken(grams: number, variant: RescueVariant) {
    if (confirm(`Confirm that you have taken ${grams} ${variant.name}`)) {
      TreatmentManager.glucose(grams, variant.name, new Date());
      goBack();
    }
  }
  function onMark() {
    markGlucoseTaken(gramsTaken, variant);
  }

  const [showTemplate, setShowTemplate] = useState(false);

  return (
    <>
      <h1>Low Correction</h1>
      {session.started && (
        <Card>
          <ToggleButton
            id="toggle-debug-logs"
            type="checkbox"
            variant={showTemplate ? "secondary" : "outline-secondary"}
            checked={showTemplate}
            value={showTemplate ? "1" : "0"}
            onChange={() => setShowTemplate(!showTemplate)}
          >
            Show Session Summary
          </ToggleButton>
          {showTemplate && (
            <TemplateSummary template={template} session={session} />
          )}
        </Card>
      )}
      <Card>
        <GlucoseSuggestion
          intelligentCorrection={intelligentCorrection}
          baseCorrection={correction}
          unitName={variant.name}
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
        <ListGroup>
          <Form.Label>Variant</Form.Label>
          <Form.Select
            onChange={(e) => {
              // You can handle insulin type selection here if needed
              const v = RescueVariantManager.getVariant(e.target.value);
              if (v) setVariant(v);
            }}
            className="mb-2"
          >
            {RescueVariantStore.variants.value.map((v) => (
              <option value={v.name}>{v.name}</option>
            ))}
          </Form.Select>
        </ListGroup>
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
          <InputGroup.Text id="basic-addon1">{variant.name}</InputGroup.Text>
        </InputGroup>
        <div className="d-flex justify-content-center flex-wrap">
          <NumberOptionSelector
            value={intelligentCorrection}
            rangeFromOrigin={2}
            increment={0.5}
            labelSuffix={variant.name.toLowerCase()[0]}
            onSelect={(val) => {
              markGlucoseTaken(val, variant);
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
