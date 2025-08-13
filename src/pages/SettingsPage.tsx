import {
  Button,
  ButtonGroup,
  Form,
  InputGroup,
  ToggleButton,
} from "react-bootstrap";
import Card from "../components/Card";
import { useState } from "react";
import RemoteStorage from "../lib/remote/storage";
import type { KeyInterface } from "../lib/storageNode";
import { PrivateStore } from "../storage/privateStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { CalibrationStore } from "../storage/calibrationStore";
import { BackendStore } from "../storage/backendStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";

interface Setting {
  title: string;
  keyInterface: KeyInterface<number>;
  iconClass: string;
  unit: string;
}
function NumberSetting({ title, keyInterface, iconClass, unit }: Setting) {
  const [, setValue] = keyInterface.useState();
  const initialValue = keyInterface.value.toString();
  return (
    <>
      <Form.Label htmlFor="basic-url">{title}</Form.Label>
      <InputGroup className="mb-3">
        <InputGroup.Text>
          <i className={iconClass}></i>
        </InputGroup.Text>
        <Form.Control
          placeholder={initialValue}
          value={initialValue}
          aria-describedby="basic-addon1"
          onChange={(a) => {
            const v = parseFloat(a.target.value);
            if (!Number.isNaN(v)) {
              setValue(v);
            }
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
          keyInterface={CalibrationStore.insulinEffect}
          title="Insulin Effect (per unit)"
          iconClass="bi bi-eyedropper"
          unit="mg/dL"
        />
        <NumberSetting
          keyInterface={BackendStore.cgmDelay}
          title="CGM Delay (in minutes)"
          iconClass="bi bi-clock"
          unit="min"
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
      </Card>
    </>
  );
}
