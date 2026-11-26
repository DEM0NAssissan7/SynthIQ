import { useNavigate } from "react-router";
import TemplateNameSearch from "../../components/TemplateNameSearch";
import Card from "../../components/Card";
import { ActivityManager } from "../../managers/activityManager";
import { SessionManager } from "../../managers/sessionManager";
import {
  ActionCard,
  ActionGrid,
  PageLayout,
} from "../../components/PageLayout";

export default function ActivitySelectPage() {
  const navigate = useNavigate();

  function advance(name: string | null) {
    if (!name) {
      alert(`Please enter a valid name`);
      throw new Error(`Cannot advance: invalid name`);
    }
    ActivityManager.select(name);
    navigate("/activity/start");
  }
  function addTemplate() {
    // A template exists once an activity with its name has been logged
    const name = prompt("Template name:");
    if (name && name.trim()) advance(name.trim());
  }
  function backToHub() {
    navigate("/hub");
  }

  return (
    <PageLayout>
      <Card>
        <TemplateNameSearch
          onInput={(name: string) => advance(name)}
          templates={ActivityManager.getTemplates()}
        />
      </Card>
      <ActionGrid>
        <ActionCard
          icon="add_circle"
          eyebrow="Template"
          title="Create a new activity template"
          body="Save a new activity pattern when the existing templates don’t fit what you’re about to do."
          buttonLabel="Create template"
          onClick={addTemplate}
        />
        {SessionManager.getCurrentSession() && (
          <ActionCard
            icon="arrow_back"
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
