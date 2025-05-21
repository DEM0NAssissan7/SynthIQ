import { Container, Row, Col, Card, Button } from "react-bootstrap";
import WizardManager from "../lib/wizardManager";
import { Link } from "react-router";
import MealGraph from "../components/MealGraph";
import NightscoutManager from "../lib/nightscoutManager";
import { useEffect, useState } from "react";
import { wizardStorage } from "../storage/wizardStore";
import { nightscoutStorage } from "../storage/nightscoutStore";

enum NightscoutAuthLevel {
  Invalid,
  Read,
  Write,
}

function HubPage() {
  const meal = wizardStorage.get("meal");

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
  }, [nightscoutStorage]);

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
                      <MealGraph
                        meal={meal}
                        from={-1}
                        until={10}
                        width="100%"
                      />
                    </>
                  ) : (
                    <>
                      <Card.Title>Active Meal</Card.Title>
                      <Card.Text>
                        You have an active meal you're building
                      </Card.Text>
                      <Button variant="primary" as={Link as any} to="/wizard">
                        Continue Building
                      </Button>
                    </>
                  )
                ) : (
                  <>
                    <Card.Title>Build A Meal</Card.Title>
                    <Card.Text>
                      Build a meal easily using our meal wizard.
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
