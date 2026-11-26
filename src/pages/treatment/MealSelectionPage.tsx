import { useNavigate } from "react-router";
import { Button } from "react-bootstrap";
import TemplateNameSearch from "../../components/TemplateNameSearch";
import Card from "../../components/Card";
import { SessionManager } from "../../managers/sessionManager";
import { EntryStore } from "../../storage/entryStore";
import Meal from "../../models/events/meal";
import { PageLayout } from "../../components/PageLayout";
import MdIcon from "../../components/md3/MdIcon";

export default function MealSelectionPage() {
  const navigate = useNavigate();

  /** Start the meal draft for `name`, pre-filled with the foods of its latest valid session */
  function advance(name: string | null) {
    const mealName = name ?? SessionManager.unnamedMealName;
    const template = SessionManager.getMealTemplate(mealName);
    const meal = new Meal(new Date(), mealName, template.UUID);
    const latestSession = name ? template.latestSession : null;
    if (latestSession)
      meal.foods = Meal.deserialize(Meal.serialize(latestSession.meal)).foods;
    EntryStore.meal.value = meal;
    navigate("/meal");
  }

  function skip() {
    if (confirm("Are you sure you want to skip naming your session?")) {
      advance(null);
    }
  }

  function addTemplate() {
    // A template exists once a meal with its name has been logged
    const name = prompt("Template name:");
    if (name && name.trim()) advance(name.trim());
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
          <MdIcon name="add" size={18} />
          <span>New template</span>
        </Button>
        <Button
          variant="outline-secondary"
          className="flex-fill d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold"
          style={{ borderRadius: "0.85rem" }}
          onClick={skip}
        >
          <span>Skip naming</span>
          <MdIcon name="arrow_forward" size={18} />
        </Button>
      </div>

      <Card>
        <TemplateNameSearch
          templates={SessionManager.getMealTemplates()}
          onInput={(name: string) => advance(name)}
        />
      </Card>
    </PageLayout>
  );
}
