import { Button, Form } from "react-bootstrap";
import { useEffect, useMemo, useState } from "react";
import { useNow } from "../state/useNow";
import { CacheStore } from "../storage/cacheStore";
import { getMinuteDiff } from "../lib/timing";
import { PreferencesStore } from "../storage/preferencesStore";
import SugarReading, { ReadingType } from "../models/types/sugarReading";
import MdIcon from "./md3/MdIcon";
import { getLatestReading } from "../lib/healthMonitor";

interface BloodSugarInputProps {
  initialGlucose: number | null;
  /** The value shown, and the reading it came from (null when there is none) */
  setInitialGlucose: (value: number, reading: SugarReading | null) => void;
  pullFromNightscout?: boolean;
  showAutoButton?: boolean;
  label?: string;
}

export default function BloodSugarInput({
  initialGlucose,
  setInitialGlucose,
  pullFromNightscout = false,
  showAutoButton = true,
  label = "Current Blood Sugar",
}: BloodSugarInputProps) {
  const [isPulling, setIsPulling] = useState(false);
  const sugarSaveTime = PreferencesStore.sugarSaveTime.value;
  const now = useNow(sugarSaveTime);

  const cacheIsValid = useMemo(() => {
    const lastBG = CacheStore.lastBG.value;
    const minutesSince = getMinuteDiff(now, lastBG.timestamp);
    return minutesSince <= sugarSaveTime;
  }, [now, sugarSaveTime]);

  /** `force` lets a CGM value replace a recent measured one */
  function setGlucose(reading: SugarReading, force = false) {
    // A CGM value does not replace a measured BG from within the save window
    if (
      !force &&
      cacheIsValid &&
      CacheStore.lastBG.value.type !== ReadingType.Normal &&
      reading.type === ReadingType.Normal
    )
      return;
    const isReading = reading.sugar > 0;
    setInitialGlucose(reading.sugar, isReading ? reading : null);
    if (isReading) CacheStore.lastBG.value = reading;
  }

  function pullCurrentGlucose(force = false) {
    setIsPulling(true);
    const BG = getLatestReading();
    if (BG) setGlucose(BG, force);
    setIsPulling(false);
  }

  useEffect(() => {
    const lastBG = CacheStore.lastBG.value;
    setInitialGlucose(lastBG.sugar, cacheIsValid ? lastBG : null);
    if (pullFromNightscout) pullCurrentGlucose();
    else if (cacheIsValid) setGlucose(lastBG);
    else setInitialGlucose(0, null);
  }, []);

  const glucoseStatus = useMemo(() => {
    if (!initialGlucose || initialGlucose <= 0) return null;
    const target = PreferencesStore.targetBG.value || 110;
    if (initialGlucose < PreferencesStore.lowBG.value) {
      return {
        label: "Low",
        color: "var(--app-status-low)",
        bg: "rgba(186, 26, 26, 0.12)",
      };
    }
    if (initialGlucose > PreferencesStore.highBG.value) {
      return {
        label: "Elevated",
        color: "var(--app-status-elevated)",
        bg: "rgba(168, 103, 0, 0.12)",
      };
    }
    if (Math.abs(initialGlucose - target) <= 15) {
      return {
        label: "On Target",
        color: "var(--app-status-target)",
        bg: "rgba(46, 125, 50, 0.12)",
      };
    }
    return {
      label: "In Range",
      color: "var(--app-status-target)",
      bg: "rgba(46, 125, 50, 0.12)",
    };
  }, [initialGlucose]);

  return (
    <Form.Group controlId="current-glucose" className="mb-3">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <Form.Label className="form-label mb-0">{label}</Form.Label>
        {glucoseStatus && (
          <span
            className="badge rounded-pill px-2 py-1 fw-semibold"
            style={{
              color: glucoseStatus.color,
              backgroundColor: glucoseStatus.bg,
              fontSize: "0.72rem",
            }}
          >
            {glucoseStatus.label}
          </span>
        )}
      </div>

      <div className="input-group">
        <span className="input-group-text border-end-0">
          <MdIcon
            name="water_drop"
            fill={true}
            size={20}
            style={{
              color: glucoseStatus
                ? glucoseStatus.color
                : "var(--md-sys-color-primary)",
            }}
          />
        </span>
        <Form.Control
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="mg/dL"
          value={initialGlucose || ""}
          className="border-start-0 border-end-0 fw-semibold"
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            // Typed in: a manual entry
            setGlucose(
              new SugarReading(
                !isNaN(value) ? value : 0,
                new Date(),
                ReadingType.Manual,
              ),
            );
          }}
        />
        <span className="input-group-text border-start-0 text-muted small pe-3">
          mg/dL
        </span>
        {showAutoButton && (
          <Button
            variant="primary"
            onClick={() => pullCurrentGlucose(true)}
            disabled={isPulling}
            className="d-inline-flex align-items-center gap-1 px-3"
            title="Fetch latest reading from Nightscout"
          >
            <MdIcon
              name="sync"
              size={18}
              className={isPulling ? "spin-animation" : ""}
            />
            <span>Auto</span>
          </Button>
        )}
      </div>
    </Form.Group>
  );
}
