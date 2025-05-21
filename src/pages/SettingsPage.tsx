/** Some settings we need to set:
 * CGM rate (should be done automatically anyways)
 * CGM Delay
 * Nightscout Profile Selection
 * Glucose (mls per cap, grams per ml)
 */

import { Form, InputGroup } from "react-bootstrap";
import { nightscoutStorage } from "../storage/nightscoutStore";

export default function SettingsPage() {
  return (
    <>
      <Form.Label htmlFor="basic-url">CGM Delay (in minutes)</Form.Label>
      <InputGroup className="mb-3">
        <InputGroup.Text>
          <i className="bi bi-clock"></i>
        </InputGroup.Text>
        <Form.Control
          placeholder={nightscoutStorage.get("cgmDelay")}
          aria-label="Username"
          aria-describedby="basic-addon1"
          onChange={(a) => nightscoutStorage.set("cgmDelay", a.target.value)}
        />
      </InputGroup>

      <Form.Label htmlFor="basic-url">Nightscout Profile Select</Form.Label>
      <InputGroup className="mb-3">
        <Form.Control
          placeholder="Recipient's username"
          aria-label="Recipient's username"
          aria-describedby="basic-addon2"
        />
        <InputGroup.Text>@example.com</InputGroup.Text>
      </InputGroup>

      <Form.Label htmlFor="basic-url">Glucose Bottles</Form.Label>
      <InputGroup className="mb-3">
        <InputGroup.Text>ml/cap</InputGroup.Text>
        <Form.Control aria-describedby="basic-addon3" />
        <InputGroup.Text>Density(g/ml)</InputGroup.Text>
        <Form.Control aria-describedby="basic-addon3" />
      </InputGroup>
    </>
  );
}
