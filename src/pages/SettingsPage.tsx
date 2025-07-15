import { Form, InputGroup } from "react-bootstrap";
import { nightscoutStore } from "../storage/nightscoutStore";
import preferencesStore from "../storage/preferencesStore";
import Card from "../components/Card";

export default function SettingsPage() {
  preferencesStore.get("maxSessionLength");
  preferencesStore.get("endingHours");

  preferencesStore.get("lowBG");
  preferencesStore.get("dangerBG");

  preferencesStore.get("insulinStepSize");
  preferencesStore.get("timeStepSize");

  preferencesStore.get("sessionHalfLife");
  preferencesStore.get("maxSessionLife");

  return (
    <>
      <Card>
        <Form.Label htmlFor="basic-url">CGM Delay (in minutes)</Form.Label>
        <InputGroup className="mb-3">
          <InputGroup.Text>
            <i className="bi bi-clock"></i>
          </InputGroup.Text>
          <Form.Control
            placeholder={nightscoutStore.get("cgmDelay")}
            aria-label="Username"
            aria-describedby="basic-addon1"
            onChange={(a) => nightscoutStore.set("cgmDelay", a.target.value)}
          />
        </InputGroup>
      </Card>

      {/* <Form.Label htmlFor="basic-url">Nightscout Profile Select</Form.Label>
      <InputGroup className="mb-3">
        <Form.Control
          placeholder="Recipient's username"
          aria-label="Recipient's username"
          aria-describedby="basic-addon2"
        />
        <InputGroup.Text>@example.com</InputGroup.Text>
      </InputGroup> */}
    </>
  );
}
