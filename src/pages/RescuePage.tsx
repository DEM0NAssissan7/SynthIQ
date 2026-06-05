import { useState, useMemo, useEffect, useReducer } from "react";
import {
  Button,
  Form,
  InputGroup,
} from "react-bootstrap";
import { useNavigate } from "react-router";
import BloodSugarInput from "../components/BloodSugarInput";
import {
  getGlucoseCorrectionCaps,
  getIntelligentGlucoseCorrection,
} from "../lib/metabolism";
import { roundByHalf } from "../lib/util";
import Card from "../components/Card";
import HealthMonitorMessage from "../components/HealthMonitorMessage";
import { populateReadingCache, getBGVelocity, getLastRescueMinutes } from "../lib/healthMonitor";
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
import LastBolusMessage from "../components/LastBolusMessage";
import {
  MetricGrid,
  MetricPill,
  PageActions,
  PageHeader,
  PageLayout,
} from "../components/PageLayout";

export default function RescuePage() {
  const [session] = WizardStore.session.useState();
  const [template] = WizardStore.template.useState();

  const [currentBG, setCurrentBG] = useState(
    session.initialGlucose
      ? session.initialGlucose
      : PreferencesStore.targetBG.value,
  );
  const [gramsTaken, setCapsTaken] = useState(0);
  const [variant, setVariant] = useState(RescueVariantManager.getDefault());

  const correction = useMemo(() => {
    return roundByHalf(getGlucoseCorrectionCaps(currentBG, variant), false);
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
            variant,
          ),
          true,
        ),
      );
    });
  }, [currentBG, variant, updated]);

  const displayRange = correction === intelligentCorrection
    ? `${correction}`
    : `${Math.min(correction, intelligentCorrection)} – ${Math.max(correction, intelligentCorrection)}`;

  const dropVelocity = getBGVelocity();
  const dropRate = `${Math.round(Math.abs(dropVelocity) / 60)} pts/min`;
  const lastRescueMinutes = getLastRescueMinutes();

  const navigate = useNavigate();
  function goBack() {
    navigate("/");
  }
  function markGlucoseTaken(amount: number, variant: RescueVariant) {
    if (confirm(`Confirm that you have taken ${amount} ${variant.name}`)) {
      TreatmentManager.glucose(amount, variant.name, new Date());
      goBack();
    }
  }
  function onMark() {
    markGlucoseTaken(gramsTaken, variant);
  }

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Treatment"
        title="Low correction"
        subtitle="Keep rescue corrections immediate while still showing the context you need."
      />

      {/* Session summary (collapsible) */}
      {session.started && (
        <Card>
          <TemplateSummary template={template} session={session} />
        </Card>
      )}

      {/* Active insulin */}
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Active insulin
        </div>
        <LastBolusMessage />
      </Card>

      {/* Recommendation */}
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Recommendation
        </div>
        <MetricGrid>
          <MetricPill
            label="Suggested dose"
            value={`${displayRange} ${variant.unitLetter}`}
          />
          <MetricPill
            label="Drop rate"
            value={dropRate}
          />
        </MetricGrid>
        <HealthMonitorMessage />
        {HealthMonitorStore.lastRescue.value.value > 0 && lastRescueMinutes < 60 && (
          <div className="rounded-3 border p-3 mt-3 bg-body-tertiary small">
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted">Last rescue</span>
              <span className="fw-semibold">
                {HealthMonitorStore.lastRescue.value.value}{" "}
                {variant.unitLetter} — {lastRescueMinutes} min ago
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Mark rescue */}
      <Card>
        <div className="small text-uppercase text-muted fw-semibold mb-2">
          Mark rescue
        </div>
        <BloodSugarInput
          initialGlucose={currentBG}
          setInitialGlucose={setCurrentBG}
          pullFromNightscout={true}
        />
        <Form.Label className="text-muted small">Variant</Form.Label>
        <Form.Select
          onChange={(e) => {
            const v = RescueVariantManager.getVariant(e.target.value);
            if (v) setVariant(v);
          }}
          className="mb-3"
        >
          {RescueVariantStore.variants.value.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
            </option>
          ))}
        </Form.Select>
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
            labelSuffix={variant.unitLetter}
            onSelect={(val) => {
              markGlucoseTaken(val, variant);
            }}
          />
        </div>
      </Card>

      <PageActions inline>
        {session.started && (
          <Button variant="secondary" onClick={goBack}>
            Back to hub
          </Button>
        )}
        <Button variant="primary" onClick={onMark}>
          Mark Glucose
        </Button>
      </PageActions>
    </PageLayout>
  );
}
