import { InputGroup, Form, Button } from "react-bootstrap";
import { nightscoutStorage } from "./lib/nightscoutManager";

function attemptContinue() {}
function testAuth() {}

function SetupPage() {
  return (
    <>
      <InputGroup className="mb-3">
        <InputGroup.Text id="basic-addon1">
          {/* Globe icon */}
          <i className="bi bi-globe"></i>
        </InputGroup.Text>
        <Form.Control
          placeholder="https://example.com"
          aria-label="URL"
          aria-describedby="basic-addon1"
          onChange={(e) => nightscoutStorage.set("url", e.target.value)}
        />
      </InputGroup>
      <InputGroup className="mb-3">
        <InputGroup.Text id="basic-addon2">
          {/* Key icon */}
          <i className="bi bi-key"></i>
        </InputGroup.Text>
        <Form.Control
          placeholder="Enter your API key"
          aria-label="API Key"
          aria-describedby="basic-addon2"
          onChange={(e) => nightscoutStorage.set("apiKey", e.target.value)}
        />
      </InputGroup>
      <div className="d-flex gap-2 mt-3">
        <Button variant="secondary" onClick={testAuth}>
          Test Authorization
        </Button>
        <Button variant="primary" onClick={attemptContinue}>
          Continue
        </Button>
      </div>
    </>
  );
}

export default SetupPage;
