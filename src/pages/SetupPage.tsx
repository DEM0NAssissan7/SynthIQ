import { InputGroup, Form, Button, Toast } from "react-bootstrap";
import { useNavigate } from "react-router";
import { useState } from "react";
import Backend from "../lib/remote/backend";
import { BackendStore } from "../storage/backendStore";
import { PrivateStore } from "../storage/privateStore";

const autoHideTime = 4000;

function SetupPage() {
  // This is usually a bad thing, but we are just pulling the current values to give the user a view on what he currently has, to allow him to change it
  const [url, setUrl] = BackendStore.url.useState();
  const [apiSecret, setApiSecret] = PrivateStore.apiSecret.useState();

  const navigate = useNavigate();
  function advance() {
    navigate("/hub");
  }
  function promptAdvance() {
    if (
      confirm(
        "Are you sure you want to skip Nightscout setup? You can always do this later in settings."
      )
    ) {
      Backend.skipSetup();
      advance();
    }
  }

  const [errorMessage, setErrorMessage] = useState("");
  const [errorMsgHidden, setErrorMsgHidden] = useState(true);

  function errorMsg(message: string) {
    setErrorMsgHidden(false);
    setTimeout(() => {
      setErrorMsgHidden(true);
    }, autoHideTime); // Dismiss after a bit
    setErrorMessage(message);
  }

  async function attemptContinue() {
    if (!url) {
      errorMsg("Please input a URL");
      return;
    }
    await Backend.verifyAuth()
      .then((a) => {
        if (a.message.canRead) {
          advance();
          return;
        }
        errorMsg(`Client does not have nightscout read permissions`);
      })
      .catch((e) => {
        console.error(e);
        errorMsg(`Could not connect to nightscout: ${e}`);
      });
  }

  async function testAuth() {
    if (!url || !apiSecret) {
      errorMsg("Please input a URL and API key");
      return;
    }
    await Backend.verifyAuth()
      .then((a) => {
        console.log(a);
        if (a.message.canRead && a.message.canWrite) {
          advance();
          return;
        }
        errorMsg(
          `Client does not have nightscout read/write permissions - read: ${a.message.canRead}, write: ${a.message.canWrite}`
        );
      })
      .catch((e) => {
        console.error(e);
        errorMsg(`Could not connect to nightscout: ${e}`);
      });
  }

  return (
    <>
      <InputGroup className="mb-3">
        <InputGroup.Text>
          {/* Globe icon */}
          <i className="bi bi-globe"></i>
        </InputGroup.Text>
        <Form.Control
          type="text"
          placeholder={url || "Enter your nightscout server URL"}
          aria-label="URL"
          aria-describedby="basic-addon1"
          onChange={(e) => setUrl(e.target.value)}
        />
      </InputGroup>
      <InputGroup className="mb-3">
        <InputGroup.Text>
          {/* Key icon */}
          <i className="bi bi-key"></i>
        </InputGroup.Text>
        <Form.Control
          type="text"
          placeholder={apiSecret || "Enter your API key"}
          aria-label="API Key"
          aria-describedby="basic-addon2"
          onChange={(e) => setApiSecret(e.target.value)}
        />
      </InputGroup>
      <Toast
        show={!errorMsgHidden}
        bg="danger"
        onClose={() => {
          setErrorMsgHidden(true);
        }}
      >
        <Toast.Header>
          <strong className="me-auto">Error</strong>
        </Toast.Header>
        <Toast.Body className="text-white">{errorMessage}</Toast.Body>
      </Toast>
      <div className="d-flex gap-2 mt-3">
        <Button variant="danger" onClick={promptAdvance}>
          Skip
        </Button>
        <Button variant="secondary" onClick={attemptContinue}>
          Continue Unauthorized
        </Button>
        <Button variant="primary" onClick={testAuth}>
          Continue
        </Button>
      </div>
    </>
  );
}

export default SetupPage;
