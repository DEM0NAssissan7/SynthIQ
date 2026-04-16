import { Alert, Badge, Button, Form, InputGroup, Toast } from "react-bootstrap";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import Backend from "../lib/remote/backend";
import { BackendStore } from "../storage/backendStore";
import { PrivateStore } from "../storage/privateStore";

const autoHideTime = 4000;

enum NightscoutAuthLevel {
  Unchecked,
  Invalid,
  Read,
  Write,
}

function SetupPage() {
  // This is usually a bad thing, but we are just pulling the current values to give the user a view on what he currently has, to allow him to change it
  const [url, setUrl] = BackendStore.url.useState();
  const [apiSecret, setApiSecret] = PrivateStore.apiSecret.useState();
  const [nightscoutAuthLevel, setNightscoutAuthLevel] = useState(
    NightscoutAuthLevel.Unchecked,
  );

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

  async function refreshAuthStatus() {
    if (!url) {
      setNightscoutAuthLevel(NightscoutAuthLevel.Invalid);
      return;
    }
    await Backend.verifyAuth()
      .then((a) => {
        if (a.message.canWrite) {
          setNightscoutAuthLevel(NightscoutAuthLevel.Write);
          return;
        }
        if (a.message.canRead) {
          setNightscoutAuthLevel(NightscoutAuthLevel.Read);
          return;
        }
        setNightscoutAuthLevel(NightscoutAuthLevel.Invalid);
      })
      .catch((e) => {
        console.error(e);
        setNightscoutAuthLevel(NightscoutAuthLevel.Invalid);
      });
  }

  useEffect(() => {
    if (!BackendStore.url.value) {
      setNightscoutAuthLevel(NightscoutAuthLevel.Invalid);
      return;
    }
    Backend.verifyAuth()
      .then((a) => {
        if (a.message.canWrite) {
          setNightscoutAuthLevel(NightscoutAuthLevel.Write);
          return;
        }
        if (a.message.canRead) {
          setNightscoutAuthLevel(NightscoutAuthLevel.Read);
          return;
        }
        setNightscoutAuthLevel(NightscoutAuthLevel.Invalid);
      })
      .catch((e) => {
        console.error(e);
        setNightscoutAuthLevel(NightscoutAuthLevel.Invalid);
      });
  }, []);

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
    await refreshAuthStatus();
  }

  async function testAuth() {
    if (!url || !apiSecret) {
      errorMsg("Please input a URL and API key");
      return;
    }
    await Backend.verifyAuth()
      .then((a) => {
        if (PrivateStore.debugLogs.value) console.log(a);
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
    await refreshAuthStatus();
  }

  return (
    <>
      <Alert variant="light" className="border shadow-sm">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div>
            <div className="small text-uppercase text-muted fw-semibold mb-1">
              Nightscout
            </div>
            <div className="fw-semibold mb-1">Connection status</div>
            {nightscoutAuthLevel === NightscoutAuthLevel.Write && (
              <div className="text-muted">
                Nightscout is connected with read and write access.
              </div>
            )}
            {nightscoutAuthLevel === NightscoutAuthLevel.Read && (
              <div className="text-muted">
                Nightscout is reachable, but this client is missing write access.
              </div>
            )}
            {nightscoutAuthLevel === NightscoutAuthLevel.Invalid && (
              <div className="text-muted">
                Nightscout is not configured correctly yet or the server is not responding.
              </div>
            )}
            {nightscoutAuthLevel === NightscoutAuthLevel.Unchecked && (
              <div className="text-muted">
                Checking the saved Nightscout configuration now.
              </div>
            )}
          </div>
          <Badge
            bg={
              nightscoutAuthLevel === NightscoutAuthLevel.Write
                ? "success"
                : nightscoutAuthLevel === NightscoutAuthLevel.Read
                  ? "warning"
                  : nightscoutAuthLevel === NightscoutAuthLevel.Unchecked
                    ? "secondary"
                    : "danger"
            }
          >
            {nightscoutAuthLevel === NightscoutAuthLevel.Write
              ? "Ready"
              : nightscoutAuthLevel === NightscoutAuthLevel.Read
                ? "Read Only"
                : nightscoutAuthLevel === NightscoutAuthLevel.Unchecked
                  ? "Checking"
                  : "Needs Setup"}
          </Badge>
        </div>
      </Alert>
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
