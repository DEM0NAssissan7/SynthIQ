import { Container, Row, Col, Card, Button } from "react-bootstrap";
import WizardManager from "../lib/wizardManager";
import { Link } from "react-router";
import NightscoutManager from "../lib/nightscoutManager";
import { useEffect, useState } from "react";
import { wizardStorage } from "../storage/wizardStore";
import { nightscoutStore } from "../storage/nightscoutStore";
import SessionGraph from "../components/SessionGraph";

enum NightscoutAuthLevel {
  Invalid,
  Read,
  Write,
}

function HubPage() {
  const session = wizardStorage.get("session");

  const [nightscoutAuthLevel, setNightscoutAuthLevel] = useState(
    NightscoutAuthLevel.Invalid
  );
  useEffect(() => {
    NightscoutManager.verifyAuth()
      .then((a) => {
        if (a.message.canWrite) {
          setNightscoutAuthLevel(NightscoutAuthLevel.Write);
        } else if (a.message.canRead) {
          setNightscoutAuthLevel(NightscoutAuthLevel.Read);
          return;
        }
      })
      .catch((e) => {
        console.error(e);
        setNightscoutAuthLevel(NightscoutAuthLevel.Invalid);
      });
  }, [nightscoutStore]);

  return (
    <Container fluid className="text-center py-4 bg-light min-vh-100">
      <header className="mb-5">
        <h1>Welcome to the Hub</h1>
        <p>Your central place for all things diabetes</p>
      </header>
      <main>
        <Row className="g-4 justify-content-center">
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card className="h-100 shadow-sm">
              <Card.Body>
                {WizardManager.isActive() ? (
                  WizardManager.isComplete() ? (
                    <>
                      <Card.Title>Realtime Meal Prediction</Card.Title>
                      <SessionGraph session={session} from={-1} width="100%" />
                      <Button variant="primary" as={Link as any} to="/wizard">
                        View Summary
                      </Button>
                    </>
                  ) : (
                    <>
                      <Card.Title>Active Meal</Card.Title>
                      <Card.Text>You have an active session</Card.Text>
                      <Button variant="primary" as={Link as any} to="/wizard">
                        Continue
                      </Button>
                    </>
                  )
                ) : (
                  <>
                    <Card.Title>Start A Session</Card.Title>
                    <Card.Text>
                      Build and interact with meals easily using our session
                      wizard.
                    </Card.Text>
                    <Button
                      variant="primary"
                      as={Link as any}
                      to="/template/select"
                    >
                      Get Started
                    </Button>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card className="h-100 shadow-sm">
              <Card.Body>
                <Card.Title>Nightscout Status</Card.Title>
                {nightscoutAuthLevel === NightscoutAuthLevel.Invalid ? (
                  <>
                    <Card.Text>
                      Nightscout isn't set up correctly or the server isn't
                      responding
                    </Card.Text>
                    <Button variant="primary" as={Link as any} to="/setup">
                      Nightscout Setup
                    </Button>
                  </>
                ) : nightscoutAuthLevel === NightscoutAuthLevel.Read ? (
                  <>
                    <Card.Text>
                      Nightscout is working, but we don't have full
                      authorization
                    </Card.Text>
                    <Button variant="secondary" as={Link as any} to="/setup">
                      Nightscout Setup
                    </Button>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check"></i>
                    <Card.Text>Nightscout is fully operational</Card.Text>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </main>
    </Container>
  );
}

export default HubPage;
