import { Navigate, useNavigate } from "react-router";
import { useMemo } from "react";
import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import Card from "../../components/Card";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import GlucoseManager from "../../components/GlucoseManager";
import InsulinManager from "../../components/InsulinManager";
import MealAdditionalNutrients from "../../components/MealAdditionalNutrientsCard";
import { Button } from "react-bootstrap";
import SessionSummary from "../../components/summary/SessionSummary";
import { SessionManager } from "../../managers/sessionManager";
import { useStream } from "../../state/useStream";
import { PageActions, PageLayout } from "../../components/PageLayout";

export default function WizardEditPage() {
  const [, streamVersion] = useStream();
  const session = useMemo(
    () => SessionManager.getCurrentSession(),
    [streamVersion],
  );
  const template = useMemo(
    () => (session ? SessionManager.getMealTemplate(session.meal.name) : null),
    [session],
  );
  // The session's meal is a composite: edit the logged meals it is made of
  const meals = useMemo(
    () => (session ? SessionManager.getMeals(session) : []),
    [session],
  );

  const navigate = useNavigate();
  if (!session || !template) return <Navigate to="/hub" replace />;
  function finishEdit() {
    navigate("/hub");
  }
  return (
    <PageLayout>
      <SessionSummary template={template} session={session} contained={true} />
      {meals.map((meal) => (
        <div key={meal.uuid}>
          <Card>
            <FoodSearchDisplay meal={meal} />
          </Card>

          <Card>
            <AddedFoodsDisplay meal={meal} />
          </Card>

          <Card>
            <MealAdditionalNutrients meal={meal} />
          </Card>
        </div>
      ))}

      <Card>
        <InsulinManager session={session} />
      </Card>

      <Card>
        <GlucoseManager session={session} />
      </Card>

      <PageActions>
        <Button variant="primary" onClick={finishEdit}>
          Done
        </Button>
      </PageActions>
    </PageLayout>
  );
}
