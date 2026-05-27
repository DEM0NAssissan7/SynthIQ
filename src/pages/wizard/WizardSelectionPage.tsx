import { useNavigate } from "react-router";
import TemplateNameSearch from "../../components/TemplateNameSearch";
import Card from "../../components/Card";
import WizardManager from "../../managers/wizardManager";
import { WizardStore } from "../../storage/wizardStore";
import {
  ActionCard,
  ActionGrid,
  PageHeader,
  PageLayout,
} from "../../components/PageLayout";

export default function WizardSelectionPage() {
  const navigate = useNavigate();

  function advance(name: string | null) {
    if (!name) {
      WizardManager.createTemplate("Session");
      WizardManager.begin(navigate);
      return;
    }
    try {
      const template = WizardManager.selectTemplate(name);
      WizardManager.selectSession(template.latestSession);
      WizardManager.begin(navigate);
    } catch (e) {
      alert(`Template named ${name} encountered an error`);
      console.error(e);
    }
  }
  function skip() {
    if (confirm("Are you sure you wanna skip naming your session?")) {
      advance(null);
    }
  }
  function addTemplate() {
    const name = prompt("Template name:");
    if (name) {
      WizardManager.createTemplate(name);
      advance(name);
    }
  }

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Wizard"
        title="Choose a meal template"
        subtitle="Reuse a known template for speed, or create a fresh one when you want a new baseline."
      />
      <Card>
        <TemplateNameSearch
          templates={WizardStore.templates.value}
          onInput={(name: string) => advance(name)}
          onDelete={(name: string) => WizardManager.deleteTemplate(name)}
        />
      </Card>

      <ActionGrid>
        <ActionCard
          icon="bi-plus-circle"
          eyebrow="Template"
          title="Create a new template"
          body="Start with a fresh template when this meal pattern doesn’t match an existing one."
          buttonLabel="Create template"
          onClick={addTemplate}
        />
        <ActionCard
          icon="bi-arrow-right-circle"
          eyebrow="Quick Start"
          title="Start without naming"
          body="Skip template naming and begin a one-off session immediately."
          buttonLabel="Skip template"
          buttonVariant="danger"
          onClick={skip}
        />
      </ActionGrid>
    </PageLayout>
  );
}
