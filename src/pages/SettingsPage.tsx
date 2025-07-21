import { Form, InputGroup } from "react-bootstrap";
import { nightscoutStore } from "../storage/nightscoutStore";
import preferencesStore from "../storage/preferencesStore";
import Card from "../components/Card";
import healthMonitorStore from "../storage/healthMonitorStore";
import type StorageNode from "../lib/storageNode";
import { useState } from "react";

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
            const v = a.target.value;
            node.set(id, v);
            setValue(v);
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

  return (
    <>
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
        <NumberSetting
          node={preferencesStore}
          id={"glucoseEffect"}
          title="Dextrose Effect (per cap/gram)"
          iconClass="bi bi-capsule"
          unit="mg/dL"
        />
        <NumberSetting
          node={nightscoutStore}
          id={"cgmDelay"}
          title="CGM Delay (in minutes)"
          iconClass="bi bi-clock"
          unit="min"
        />
      </Card>
    </>
  );
}
