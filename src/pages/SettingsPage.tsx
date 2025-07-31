import {
  Button,
  ButtonGroup,
  Form,
  InputGroup,
  ToggleButton,
} from "react-bootstrap";
import { backendStore } from "../storage/backendStore";
import preferencesStore from "../storage/preferencesStore";
import Card from "../components/Card";
import healthMonitorStore from "../storage/healthMonitorStore";
import type StorageNode from "../lib/storageNode";
import { useState } from "react";
import RemoteStorage from "../lib/remote/storage";
import privateStore from "../storage/privateStore";
import basalStore from "../storage/basalStore";

interface Setting {
  title: string;
  node: StorageNode;
  id: string;
  iconClass: string;
  unit: string;
}
function NumberSetting({ title, node, id, iconClass, unit }: Setting) {
  const [value, setValue] = useState(node.get(id));

  return (
    <>
      <Form.Label htmlFor="basic-url">{title}</Form.Label>
      <InputGroup className="mb-3">
        <InputGroup.Text>
          <i className={iconClass}></i>
        </InputGroup.Text>
        <Form.Control
          placeholder={node.get(id)}
          value={value}
          aria-describedby="basic-addon1"
          onChange={(a) => {
            const v = parseFloat(a.target.value);
            if (!Number.isNaN(v)) {
              node.set(id, v);
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
  preferencesStore.get("maxSessionLength");
  preferencesStore.get("endingHours");

  healthMonitorStore.get("dropTime");
  healthMonitorStore.get("timeBetweenShots");

  preferencesStore.get("insulinStepSize");
  preferencesStore.get("timeStepSize");

  preferencesStore.get("sessionHalfLife");
  preferencesStore.get("maxSessionLife");

  function uploadStorage() {
    if (
      confirm(
        `Are you sure you want to upload data to backend? You will overwrite ALL user data on backend.`
      )
    )
      RemoteStorage.upload();
  }
  function downloadStorage() {
    if (
      confirm(
        `Are you sure you want to download data from backend? You will overwrite ALL local user data.`
      )
    )
      RemoteStorage.download();
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
    getSelectedIndexFromValue(privateStore.get("isMaster"))
  );
  function setSyncState(state: boolean | null) {
    RemoteStorage.setMaster(state);
    setSelectedIndex(getSelectedIndexFromValue(state));
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
          node={preferencesStore}
          id="highBG"
          title="High Blood Sugar Threshold"
          iconClass="bi bi-arrow-up-circle"
          unit="mg/dL"
        />
        <NumberSetting
          node={preferencesStore}
          id="lowBG"
          title="Low Blood Sugar Threshold"
          iconClass="bi bi-arrow-down-circle"
          unit="mg/dL"
        />
        <NumberSetting
          node={preferencesStore}
          id="dangerBG"
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
          node={preferencesStore}
          id={"glucoseEffect"}
          title="Dextrose Effect (per cap/gram)"
          iconClass="bi bi-capsule"
          unit="mg/dL"
        />
        <NumberSetting
          node={preferencesStore}
          id={"insulinEffect"}
          title="Insulin Effect (per unit)"
          iconClass="bi bi-eyedropper"
          unit="mg/dL"
        />
        <NumberSetting
          node={backendStore}
          id={"cgmDelay"}
          title="CGM Delay (in minutes)"
          iconClass="bi bi-clock"
          unit="min"
        />
      </Card>
      <Card>
        <NumberSetting
          node={healthMonitorStore}
          id={"basalShotsPerDay"}
          title="Basal Injections Per Day"
          iconClass="bi bi-capsule"
          unit="shots"
        />
        <NumberSetting
          node={healthMonitorStore}
          id={"basalShotTime"}
          title="Basal Injection First Hour"
          iconClass="bi bi-clock"
          unit=""
        />
        <NumberSetting
          node={basalStore}
          id={"basalEffect"}
          title="Basal Insulin Effect (per unit)"
          iconClass="bi bi-eyedropper"
          unit="mg/dL per hr"
        />
      </Card>
    </>
  );
}
