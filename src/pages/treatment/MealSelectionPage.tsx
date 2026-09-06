import { useNavigate } from "react-router";
import { Button } from "react-bootstrap";
import TemplateNameSearch from "../../components/TemplateNameSearch";
import Card from "../../components/Card";
import WizardManager from "../../managers/wizardManager";
import { WizardStore } from "../../storage/wizardStore";
import { PageLayout } from "../../components/PageLayout";

export default function MealSelectionPage() {
  const navigate = useNavigate();

  function advance(name: string | null) {
    if (!name) {
      WizardManager.createTemplate("Session");
      WizardManager.setGlobMeta("Session"); // Make it able to see all sessions
      navigate("/meal");
      return;
    }
    try {
      const template = WizardManager.selectTemplate(name);
      const latestSession = template.latestSession;
      if (!latestSession) {
        // New template, no sessions yet — jump straight to meal
        WizardManager.setGlobMeta(name);
        navigate("/meal");
        return;
      }
      WizardManager.selectSession(latestSession!);
      navigate("/meal");
    } catch (e) {
      alert(`Template named ${name} encountered an error`);
      console.error(e);
    }
  }

  function skip() {
    if (confirm("Are you sure you want to skip naming your session?")) {
      advance(null);
    }
  }

  function addTemplate() {
    const name = prompt("Template name:");
    if (name && name.trim()) {
      try {
        WizardManager.createTemplate(name.trim());
        advance(name.trim());
      } catch (e: any) {
        alert(e.message || "Failed to create template");
      }
    }
  }

  return (
    <PageLayout>
      <div className="d-flex gap-2 mb-3">
        <Button
          variant="primary"
          className="flex-fill d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold"
          style={{ borderRadius: "0.85rem" }}
          onClick={addTemplate}
        >
          <i className="bi bi-plus-lg" />
          <span>New template</span>
        </Button>
        <Button
          variant="outline-secondary"
          className="flex-fill d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold"
          style={{ borderRadius: "0.85rem" }}
          onClick={skip}
        >
          <span>Skip naming</span>
          <i className="bi bi-arrow-right" />
        </Button>
      </div>

      <Card>
        <TemplateNameSearch
          templates={WizardStore.templates.value}
          onInput={(name: string) => advance(name)}
          onDelete={(name: string) => WizardManager.deleteTemplate(name)}
        />
      </Card>
    </PageLayout>
  );
}
