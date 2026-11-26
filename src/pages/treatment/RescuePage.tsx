import { useState, useMemo, useEffect, useReducer } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import { useNavigate } from "react-router";
import BloodSugarInput from "../../components/BloodSugarInput";
import {
  getGlucoseCorrectionCaps,
  getIntelligentGlucoseCorrection,
} from "../../lib/metabolism";
import { roundByHalf } from "../../lib/util";
import Card from "../../components/Card";
import HealthMonitorMessage from "../../components/HealthMonitorMessage";
import {
  getBGVelocity,
  getLastRescueMinutes,
  getLastRescue,
  getLatestReadings,
  getRecentBoluses,
  getRecentRescues,
} from "../../lib/healthMonitor";
import { HealthMonitorStore } from "../../storage/healthMonitorStore";
import { PreferencesStore } from "../../storage/preferencesStore";
import { NumberOptionSelector } from "../../components/NumberOptionSelector";
import { RescueVariantManager } from "../../managers/rescueVariantManager";
import type { RescueVariant } from "../../models/types/rescueVariant";
import { RescueVariantStore } from "../../storage/rescueVariantStore";
import { useNow } from "../../state/useNow";
import {
  MetricGrid,
  MetricPill,
  PageActions,
  PageLayout,
} from "../../components/PageLayout";
import { StreamManager } from "../../managers/streamManager";
import { SessionManager } from "../../managers/sessionManager";
import { useStream } from "../../state/useStream";
import MdIcon from "../../components/md3/MdIcon";
import { estimateDynamicISF } from "../../lib/helpers/estimateDynamicISF";
import { useEnteredBG } from "../../state/useEnteredBG";

export default function RescuePage() {
  const [stream, streamVersion] = useStream();
  const isFasting = useMemo(() => SessionManager.isFasting(), [streamVersion]);

  const [currentBG, setCurrentBG, currentReading] = useEnteredBG();
  const [variant, setVariant] = useState(RescueVariantManager.getDefault());
  const readings = useMemo(() => getLatestReadings(stream), [streamVersion]);
  const insulinsOnBoard = useMemo(
    () => getRecentBoluses(stream),
    [streamVersion],
  );
  const rescues = useMemo(() => getRecentRescues(stream), [streamVersion]);

  const correction = useMemo(() => {
    return currentBG
      ? roundByHalf(getGlucoseCorrectionCaps(currentBG, variant), false)
      : 0;
  }, [currentBG, variant]);
  const [intelligentCorrection, setIntelligentCorrection] = useState(0);

  const now = useNow();
  const [updated, update] = useReducer((a) => a + 1, 0);
  useEffect(() => {
    StreamManager.populateFromRemote().then(update);
  }, [now]);
  useEffect(() => {
    StreamManager.populateFromRemote().then(() => {
      const actingMinutes = HealthMonitorStore.dropTime.value;
      const readings = getLatestReadings();
      const insulinsOnBoard = getRecentBoluses();

      setIntelligentCorrection(
        roundByHalf(
          getIntelligentGlucoseCorrection(
            currentBG ?? PreferencesStore.targetBG.value,
            actingMinutes,
            variant,
            readings,
            insulinsOnBoard,
            rescues,
          ),
          true,
        ),
      );
    });
    setIntelligentCorrection(correction); // Fallback if there is no CGM data
  }, [currentBG, variant, updated, correction, rescues]);
  const dynamicISF = useMemo(
    () => estimateDynamicISF(readings, insulinsOnBoard, rescues),
    [readings, insulinsOnBoard, rescues],
  );

  const displayRange =
    correction === intelligentCorrection
      ? `${correction}`
      : `${Math.min(correction, intelligentCorrection)} - ${Math.max(correction, intelligentCorrection)}`;

  const dropVelocity = getBGVelocity();
  const dropRate = `${Math.round(Math.abs(dropVelocity))} pts/hr`;
  const lastRescueMinutes = getLastRescueMinutes();
  const lastRescue = getLastRescue();

  const navigate = useNavigate();
  function goBack() {
    navigate("/");
  }
  function markGlucoseTaken(amount: number, variant: RescueVariant) {
    if (isFasting && !currentBG) {
      alert(`You must input your current blood sugar for a fasting rescue`);
      return;
    }
    if (confirm(`Confirm that you have taken ${amount} ${variant.name}`)) {
      const timestamp = new Date();
      StreamManager.markReading(currentReading, timestamp);
      StreamManager.markRescue(amount, timestamp, variant);
      goBack();
    }
  }
  const [gramsTaken, setCapsTaken] = useState(intelligentCorrection);
  const [inputGlucose, setInputGlucose] = useState("");
  useMemo(() => {
    if (inputGlucose.length === 0) setCapsTaken(intelligentCorrection);
  }, [intelligentCorrection]);
  function onMark() {
    markGlucoseTaken(gramsTaken, variant);
  }

  return (
    <PageLayout>
      {/* Recommendation */}
      <Card>
        <div className="app-card-title">
          <MdIcon name="health_and_safety" className="text-danger" size={20} />
          <span>Recommendation</span>
        </div>
        <MetricGrid>
          <MetricPill
            label="Suggested dose"
            value={`${displayRange} ${variant.unitLetter}`}
          />
          <MetricPill label="Drop rate" value={dropRate} />
          <MetricPill label="Dynamic ISF" value={`${Math.round(dynamicISF)}`} />
        </MetricGrid>
        <HealthMonitorMessage />
        {lastRescue && lastRescue.value > 0 && lastRescueMinutes < 60 && (
          <div className="app-dosing-banner mt-3">
            <span className="dosing-label d-flex align-items-center gap-2">
              <MdIcon name="history" className="text-muted" size={18} />
              <span>Last rescue</span>
            </span>
            <span className="dosing-value">
              {lastRescue.value} {lastRescue.variant.unitLetter}
              <span className="dosing-note">({lastRescueMinutes} min ago)</span>
            </span>
          </div>
        )}
      </Card>

      {/* Mark rescue */}
      <Card>
        <div className="app-card-title">
          <MdIcon name="bolt" className="text-primary" size={20} />
          <span>Mark rescue</span>
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
            <MdIcon name="pill" size={18} />
          </InputGroup.Text>
          <Form.Control
            type="number"
            inputMode="decimal"
            step="any"
            placeholder={intelligentCorrection.toString()}
            aria-describedby="basic-addon1"
            value={inputGlucose}
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setCapsTaken(val);
              else setCapsTaken(intelligentCorrection);
              setInputGlucose(e.target.value);
            }}
          />
          <InputGroup.Text id="basic-addon1">{variant.name}</InputGroup.Text>
        </InputGroup>
        <div className="w-100 mb-2">
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

      <PageActions>
        <Button variant="primary" onClick={onMark}>
          Mark Glucose
        </Button>
      </PageActions>
    </PageLayout>
  );
}
