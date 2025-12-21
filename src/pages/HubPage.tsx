import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import Backend from "../lib/remote/backend";
import { WizardStore } from "../storage/wizardStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import HealthMonitorStatus from "../models/types/healthMonitorStatus";
import { InsulinExpirationManager } from "../managers/expirationManager";

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
  const [healthStatus] = HealthMonitorStore.statusCache.useState();
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
                {(() => {
                  switch (healthStatus) {
                    case HealthMonitorStatus.Nominal:
                      return (
                        <>
                          <Card.Title>Nominal Health</Card.Title>
                          <Card.Text>No pending alerts</Card.Text>
                          <i className="bi bi-check"></i>
                        </>
                      );
                    case HealthMonitorStatus.InsulinExpired:
                      const expired = InsulinExpirationManager.getExpired();
                      return (
                        <>
                          <Card.Title>Insulin Expired</Card.Title>
                          <Card.Text>
                            {expired.length} insulin(s) expired
                          </Card.Text>
                          {expired.map((e) => (
                            <>
                              <span className="text-muted">{e.fullName}</span>
                              <br />
                            </>
                          ))}
                          <br />
                          <Button
                            variant="primary"
                            as={Link as any}
                            to="/expirations"
                          >
                            View Insulin Expirations
                          </Button>
                        </>
                      );
                    case HealthMonitorStatus.Basal:
                      return (
                        <>
                          <Card.Title>Basal Injection</Card.Title>
                          <Card.Text>Your injection is due</Card.Text>
                          <Button
                            variant="primary"
                            as={Link as any}
                            to="/basal"
                          >
                            Take Injection
                          </Button>
                        </>
                      );
                    case HealthMonitorStatus.Low:
                      return (
                        <>
                          <Card.Title>Low Blood Sugar</Card.Title>
                          <Card.Text>
                            Your blood sugar is below target range
                          </Card.Text>
                          <Button
                            variant="primary"
                            as={Link as any}
                            to="/rescue"
                          >
                            Take Low Correction
                          </Button>
                        </>
                      );

                    case HealthMonitorStatus.Falling:
                      return (
                        <>
                          <Card.Title>Falling Blood Sugar</Card.Title>
                          <Card.Text>
                            Your blood sugar is falling quickly
                          </Card.Text>
                          <Button
                            variant="primary"
                            as={Link as any}
                            to="/rescue"
                          >
                            Take Low Correction
                          </Button>
                        </>
                      );
                    case HealthMonitorStatus.High:
                      <>
                        <Card.Title>High Blood sugar</Card.Title>
                        <Card.Text>
                          Your blood sugar is above the target range
                        </Card.Text>
                        <Button
                          variant="primary"
                          as={Link as any}
                          to="/insulin"
                        >
                          Take Insulin
                        </Button>
                      </>;
                  }
                  return <></>;
                })()}
              </Card.Body>
            </Card>
          </Col>
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
