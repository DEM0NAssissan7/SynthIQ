import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import Backend from "../lib/remote/backend";
import { WizardStore } from "../storage/wizardStore";

enum NightscoutAuthLevel {
  Invalid,
  Read,
  Write,
}

function HubPage() {
  const [nightscoutAuthLevel, setNightscoutAuthLevel] = useState(
    NightscoutAuthLevel.Invalid
  );
  const [session] = WizardStore.session.useState();
  useEffect(() => {
    Backend.verifyAuth()
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
  }, []);

  return (
    <Container fluid className="text-center py-4 bg-light min-vh-100">
      <header className="mb-5">
        <h1>Welcome to the Hub</h1>
      </header>
      <main>
        <Row className="g-4 justify-content-center">
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card className="h-100 shadow-sm">
              <Card.Body>
                {session.started ? (
                  <>
                    <Card.Title>Active Session</Card.Title>
                    <Card.Text>You have an active session</Card.Text>
                    <Button variant="primary" as={Link as any} to="/wizard">
                      View
                    </Button>
                  </>
                ) : (
                  <>
                    <Card.Title>Start A Session</Card.Title>
                    <Card.Text>
                      Build and interact with meals easily using our session
                      wizard.
                    </Card.Text>
                    <Button variant="primary" as={Link as any} to="/wizard">
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
