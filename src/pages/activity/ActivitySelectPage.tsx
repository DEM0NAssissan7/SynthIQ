import { useNavigate } from "react-router";
import TemplateNameSearch from "../../components/TemplateNameSearch";
import Card from "../../components/Card";
import { Button } from "react-bootstrap";
import { ActivityStore } from "../../storage/activityStore";
import { ActivityManager } from "../../managers/activityManager";
import { ActivityPage } from "../../models/types/activityPage";

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

  return (
    <div className="wizard-page">
      <h2>Get Started With an Activity Template</h2>
      <p>Select a template from the list below or add a new one.</p>
      <Card>
        <TemplateNameSearch
          onInput={(name: string) => advance(name)}
          onDelete={(name: string) => ActivityManager.deleteTemplate(name)}
          templates={ActivityStore.templates.value}
        />
      </Card>
      <div className="pt-3 d-flex justify-content-end">
        <Button variant="primary" onClick={addTemplate}>
          Create New Template
        </Button>
      </div>
    </div>
  );
}
