import { useNavigate } from "react-router";
import TemplateNameSearch from "../../components/TemplateNameSearch";
import Card from "../../components/Card";
import { ActivityStore } from "../../storage/activityStore";
import { ActivityManager } from "../../managers/activityManager";
import { ActivityPage } from "../../models/types/activityPage";
import { WizardStore } from "../../storage/wizardStore";
import {
  ActionCard,
  ActionGrid,
  PageHeader,
  PageLayout,
} from "../../components/PageLayout";

export default function ActivitySelectPage() {
  const navigate = useNavigate();

  function advance(name: string | null) {
    if (!name) {
      alert(`Please enter a valid name`);
      throw new Error(`Cannot advance: invalid name`);
    }
    try {
      ActivityManager.selectTemplate(name);
    } catch (e) {
      alert(`Template named ${name} encountered an error`);
      console.error(e);
    }
    ActivityManager.navigateTo(navigate, ActivityPage.Start);
  }
  function addTemplate() {
    const name = prompt("Template name:");
    if (name) {
      ActivityManager.createTemplate(name);
      advance(name);
    }
  }
  function backToHub() {
    navigate("/wizard/hub");
  }

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Activity"
        title="Choose an activity template"
        subtitle="Pick a saved template or create a new one so activity tracking starts with the right baseline."
      />
      <Card>
        <TemplateNameSearch
          onInput={(name: string) => advance(name)}
          onDelete={(name: string) => ActivityManager.deleteTemplate(name)}
          templates={ActivityStore.templates.value}
        />
      </Card>
      <ActionGrid>
        <ActionCard
          icon="bi-plus-circle"
          eyebrow="Template"
          title="Create a new activity template"
          body="Save a new activity pattern when the existing templates don’t fit what you’re about to do."
          buttonLabel="Create template"
          onClick={addTemplate}
        />
        {WizardStore.session.value.started && (
          <ActionCard
            icon="bi-arrow-left-circle"
            eyebrow="Session"
            title="Return to session hub"
            body="Go back to the meal session without starting a new activity flow yet."
            buttonLabel="Back to hub"
            buttonVariant="secondary"
            onClick={backToHub}
          />
        )}
      </ActionGrid>
    </PageLayout>
  );
}
