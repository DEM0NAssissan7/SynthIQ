import { useNavigate } from "react-router";
import TemplateNameSearch from "../../components/TemplateNameSearch";
import Card from "../../components/Card";
import { Button } from "react-bootstrap";
import WizardManager from "../../lib/wizardManager";
import TemplateManager from "../../lib/templateManager";

export default function TemplateSelectionPage() {
  const navigate = useNavigate();

  function advance(name: string | null) {
    if (!name) {
      TemplateManager.deactivate();
      WizardManager.begin(navigate);
      return;
    }
    try {
      TemplateManager.selectTemplate(name);
    } catch (e) {
      alert(`Template named ${name} encountered an error`);
      console.error(e);
    }
    TemplateManager.begin(navigate);
  }
  function skip() {
    if (confirm("Are you sure you wanna skip naming your session?")) {
      advance(null);
    }
  }
  function addTemplate() {
    const name = prompt("Template name:");
    if (name) {
      TemplateManager.createTemplate(name);
      advance(name);
    }
  }

  return (
    <div className="wizard-page">
      <h2>Get Started With a Template</h2>
      <p>Select a template from the list below or add a new one.</p>
      <Card>
        <TemplateNameSearch onInput={(name: string) => advance(name)} />
      </Card>
      <div className="pt-3 d-flex justify-content-end">
        <Button variant="danger" onClick={skip} className="me-auto">
          Skip
        </Button>
        <Button variant="primary" onClick={addTemplate}>
          Create New Template
        </Button>
      </div>
    </div>
  );
}
