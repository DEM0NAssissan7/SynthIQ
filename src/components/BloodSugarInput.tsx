import { Button, Form } from "react-bootstrap";
import { useEffect, useMemo } from "react";
import RemoteReadings from "../lib/remote/readings";
import { useNow } from "../state/useNow";
import { CacheStore } from "../storage/cacheStore";
import { getMinuteDiff } from "../lib/timing";
import { PreferencesStore } from "../storage/preferencesStore";
import SugarReading from "../models/types/sugarReading";

interface BloodSugarInputProps {
  initialGlucose: number | null;
  setInitialGlucose: (value: number) => void;
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
  const sugarSaveTime = PreferencesStore.sugarSaveTime.value;
  const now = useNow(sugarSaveTime);
  const cacheIsValid = useMemo(() => {
    const lastBG = CacheStore.lastBG.value;
    const minutesSince = getMinuteDiff(now, lastBG.timestamp);
    return minutesSince <= sugarSaveTime;
  }, [now]);
  function setGlucose(bg: number, isCalibration = false) {
    // If we have a valid calibration cache and we are trying to populate with a non-calibration
    if (cacheIsValid && CacheStore.lastBG.value.isCalibration && !isCalibration)
      return;
    setInitialGlucose(bg);
    if (bg)
      CacheStore.lastBG.value = new SugarReading(bg, new Date(), isCalibration);
  }
  function pullCurrentGlucose(force = false) {
    RemoteReadings.getCurrentSugar().then((g) => {
      setGlucose(g, force);
    });
  }
  useEffect(() => {
    const lastBG = CacheStore.lastBG.value;
    setInitialGlucose(lastBG.sugar);
    if (pullFromNightscout)
      pullCurrentGlucose(); // Pull glucose upon component load
    else setGlucose(cacheIsValid ? lastBG.sugar : 0);
  }, []);
  return (
    <Form.Group controlId="current-glucose" className="mb-3">
      <Form.Label className="text-muted">{label}</Form.Label>
      <div className="input-group">
        <span className="input-group-text">
          <i className="bi bi-droplet"></i>
        </span>
        <Form.Control
          type="number"
          value={initialGlucose || ""} // controlled value
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            setGlucose(!isNaN(value) ? value : 0, true);
          }}
        />
        {showAutoButton && (
          <Button variant="primary" onClick={() => pullCurrentGlucose(true)}>
            Auto
          </Button>
        )}
      </div>
    </Form.Group>
  );
}
