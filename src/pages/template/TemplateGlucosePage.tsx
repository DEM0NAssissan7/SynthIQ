import { useMemo, useState } from "react";
import BloodSugarInput from "../../components/BloodSugarInput";
import { getGlucoseCorrectionCaps } from "../../lib/metabolism";
import { Button, Form, InputGroup } from "react-bootstrap";
import { round } from "../../lib/util";
import WizardManager from "../../lib/wizardManager";
import { useNavigate } from "react-router";
import { useWizardSession } from "../../state/useSession";
import Card from "../../components/Card";
import TemplateManager from "../../lib/templateManager";
import { TemplateState } from "../../models/types/templateState";
import TemplateSessionSummary from "../../components/TemplateSessionSummary";

export default function TemplateGlucosePage() {
  const session = useWizardSession();
  const template = TemplateManager.getTemplate();

  const [currentGlucose, setCurrentGlucose] = useState(session.initialGlucose);

  const correction = useMemo(() => {
    return round(getGlucoseCorrectionCaps(currentGlucose), 1);
  }, [currentGlucose]);

  const [capsTaken, setCapsTaken] = useState(0);

  const navigate = useNavigate();
  function goBack() {
    TemplateManager.moveToPage(TemplateState.Hub, navigate);
  }
  function markGlucose() {
    if (confirm(`Confirm that you have taken ${capsTaken} caps of glucose`)) {
      WizardManager.markGlucose(capsTaken);
      goBack();
    }
  }

  return (
    <>
      <h1>Glucose Correction</h1>
      <Card>
        <TemplateSessionSummary template={template} session={session} />
      </Card>
      <Card>
        <BloodSugarInput
          initialGlucose={currentGlucose}
          setInitialGlucose={setCurrentGlucose}
        />
        <InputGroup className="mb-3">
          <InputGroup.Text id="basic-addon1">
            <i className="bi bi-capsule"></i>
          </InputGroup.Text>
          <Form.Control
            placeholder={correction.toString()}
            aria-label="URL"
            aria-describedby="basic-addon1"
            onChange={(e: any) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setCapsTaken(val);
              else setCapsTaken(0);
            }}
          />
          <InputGroup.Text id="basic-addon1">caps</InputGroup.Text>
        </InputGroup>
      </Card>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={goBack}>
          Go Back
        </Button>
        <Button variant="primary" onClick={markGlucose}>
          Mark Glucose
        </Button>
      </div>
    </>
  );
}
