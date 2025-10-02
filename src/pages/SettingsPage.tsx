import {
  Button,
  ButtonGroup,
  Form,
  InputGroup,
  ToggleButton,
} from "react-bootstrap";
import Card from "../components/Card";
import { useMemo, useState } from "react";
import RemoteStorage from "../lib/remote/storage";
import type { KeyInterface } from "../storage/storageNode";
import { PrivateStore } from "../storage/privateStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { CalibrationStore } from "../storage/calibrationStore";
import { BackendStore } from "../storage/backendStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import StorageBackends from "../registries/storageBackends";
import { BasalStore } from "../storage/basalStore";

interface Setting {
  title: string;
  keyInterface: KeyInterface<number>;
  iconClass: string;
  unit: string;
}
function NumberSetting({ title, keyInterface, iconClass, unit }: Setting) {
  const [, setValue] = keyInterface.useState();
  const [displayValue, setDisplayValue] = useState(
    keyInterface.value.toString()
  );
  const initialValue = useMemo(() => keyInterface.value.toString(), []);
  return (
    <>
      <Form.Label htmlFor="basic-url">{title}</Form.Label>
      <InputGroup className="mb-3">
        <InputGroup.Text>
          <i className={iconClass}></i>
        </InputGroup.Text>
        <Form.Control
          type="number"
          placeholder={initialValue}
          value={displayValue}
          aria-describedby="basic-addon1"
          onChange={(a) => {
            const v = parseFloat(a.target.value);
            if (!Number.isNaN(v)) {
              setValue(v);
            }
            setDisplayValue(a.target.value);
          }}
        />
        <InputGroup.Text>{unit}</InputGroup.Text>
      </InputGroup>
    </>
  );
}

export default function SettingsPage() {
  function uploadStorage() {
    if (
      confirm(
        `Are you sure you want to upload data to backend? You will overwrite ALL user data on backend.`
      )
    )
      RemoteStorage.upload();
  }
  async function downloadStorage() {
    if (
      confirm(
        `Are you sure you want to download data from backend? You will overwrite ALL local user data.`
      )
    ) {
      const synced = await RemoteStorage.download(true);
      if (synced) location.reload();
      else console.warn(`Force download didn't work properly`);
    }
  }
  function clearData() {
    if (
      confirm(
        `Are you sure you want to clear ALL local data? This action cannot be reversed, and you will lose ALL local data.`
      )
    ) {
      if (
        confirm(
          `Confirmation: Are you absolutely sure that you want to wipe ALL local data`
        )
      ) {
        const backend = StorageBackends.getDefault();
        backend.clear();
        location.reload();
      }
    }
  }

  const syncOptions: [boolean | null, string][] = [
    [null, "Disabled"],
    [false, "Slave"],
    [true, "Master"],
  ];
  function getSelectedIndexFromValue(state: boolean | null) {
    switch (state) {
      case null:
        return 0;
      case false:
        return 1;
      case true:
        return 2;
    }
  }
  const [selectedIndex, setSelectedIndex] = useState(
    getSelectedIndexFromValue(PrivateStore.isMaster.value)
  );
  function setSyncState(value: boolean | null) {
    PrivateStore.isMaster.value = value;
    setSelectedIndex(getSelectedIndexFromValue(value));
  }
  return (
    <>
      <div className="d-flex gap-2 mb-3">
        <Button onClick={downloadStorage} variant="primary">
          Download Data
        </Button>
        <Button onClick={uploadStorage} variant="danger">
          Upload Data
        </Button>
        <Button onClick={clearData} variant="danger">
          Clear All Data
        </Button>
      </div>
      <Card>
        <NumberSetting
          keyInterface={PreferencesStore.highBG}
          title="High Blood Sugar Threshold"
          iconClass="bi bi-arrow-up-circle"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={PreferencesStore.lowBG}
          title="Low Blood Sugar Threshold"
          iconClass="bi bi-arrow-down-circle"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={PreferencesStore.dangerBG}
          title="Hypoglycemic Threshold"
          iconClass="bi bi-exclamation-octagon"
          unit="mg/dL"
        />
      </Card>
      <Card>
        <ButtonGroup>
          {syncOptions.map((a, i) => (
            <ToggleButton
              key={i}
              id={`sync-radio-${i}`}
              type="radio"
              variant={
                (i === 0 && "outline-secondary") ||
                (i === 1 && "outline-primary") ||
                "outline-danger"
              }
              value={i}
              onChange={() => setSyncState(a[0])}
              checked={i === selectedIndex}
            >
              {a[1]}
            </ToggleButton>
          ))}
        </ButtonGroup>
      </Card>
      <Card>
        <NumberSetting
          keyInterface={CalibrationStore.glucoseEffect}
          title="Dextrose Effect (per cap/gram)"
          iconClass="bi bi-capsule"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={CalibrationStore.carbsEffect}
          title="Carbs Effect (per gram)"
          iconClass="bi bi-cake2"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={CalibrationStore.proteinEffect}
          title="Protein Effect (per gram)"
          iconClass="bi bi-egg-fried"
          unit="mg/dL"
        />
      </Card>
      <Card>
        <NumberSetting
          keyInterface={BackendStore.cgmDelay}
          title="CGM Delay (in minutes)"
          iconClass="bi bi-clock"
          unit="min"
        />
        <NumberSetting
          keyInterface={PreferencesStore.overshootOffset}
          title="Bolus Target Overcompensation Offset"
          iconClass="bi bi-arrow-down-short"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={PreferencesStore.maxSessionLife}
          title="Max Session Life"
          iconClass="bi bi-clock"
          unit="days"
        />
      </Card>
      <Card>
        <NumberSetting
          keyInterface={HealthMonitorStore.basalShotsPerDay}
          title="Basal Injections Per Day"
          iconClass="bi bi-capsule"
          unit="shots"
        />
        <NumberSetting
          keyInterface={HealthMonitorStore.basalShotTime}
          title="Basal Injection First Hour"
          iconClass="bi bi-clock"
          unit=""
        />
        <NumberSetting
          keyInterface={CalibrationStore.basalEffect}
          title="Basal Insulin Effect (per unit)"
          iconClass="bi bi-eyedropper"
          unit="mg/dL per hr"
        />
        <NumberSetting
          keyInterface={BasalStore.basalEffectDays}
          title="Basal Insulin Effective Days"
          iconClass="bi bi-clock"
          unit="days"
        />
      </Card>
      <Card>
        <NumberSetting
          keyInterface={BasalStore.minTimeSinceMeal}
          title="Meal Effective Time"
          iconClass="bi bi-clock"
          unit="hours"
        />
        <NumberSetting
          keyInterface={BasalStore.minTimeSinceBolus}
          title="Bolus Effective Time"
          iconClass="bi bi-clock"
          unit="hours"
        />
        <NumberSetting
          keyInterface={BasalStore.minTimeSinceDextrose}
          title="Dextrose Effective Time"
          iconClass="bi bi-clock"
          unit="minutes"
        />
      </Card>
    </>
  );
}
