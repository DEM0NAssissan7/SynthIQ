import { useState, useMemo, useEffect } from "react";
import { Button, Form, InputGroup, ListGroup } from "react-bootstrap";
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
import { RescueVariantManager } from "../managers/rescueVariantManager";
import type { RescueVariant } from "../models/types/rescueVariant";
import { RescueVariantStore } from "../storage/rescueVariantStore";

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
            actingMinutes,
            variant
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
  function markGlucoseTaken(grams: number, variant: RescueVariant) {
    if (confirm(`Confirm that you have taken ${grams} ${variant.name}`)) {
      WizardManager.markGlucose(grams, variant);
      markGlucose(grams, variant);
      ActivityManager.markGlucose(grams, variant);
      RemoteTreatments.markGlucose(grams, new Date(), variant.name);
      goBack();
    }
  }
  function onMark() {
    markGlucoseTaken(gramsTaken, variant);
  }

  return (
    <>
      <h1>Low Correction</h1>
      {session.started && (
        <Card>
          <TemplateSummary template={template} session={session} />
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
