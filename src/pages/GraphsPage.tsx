import Card from "../components/Card";
import type MealTemplate from "../models/mealTemplate";
import type Session from "../models/session";
import { WizardStore } from "../storage/wizardStore";
import { PrivateStore } from "../storage/privateStore";
import SessionGraph from "../components/SessionGraph";

export default function GraphsPage() {
  return (
    <>
      {WizardStore.templates.value.map((template: MealTemplate, i) => (
        <Card key={i}>
          <h1>{template.name}</h1>
          {[...template.sessions].reverse().map((session: Session, j) => {
            if (session.meals.length < 1) return <></>;
            if (session.snapshot.readings.length < 12) return <></>;
            if (session.snapshot.length < 1) return <></>;
            if (PrivateStore.debugLogs.value)
              console.log(
                template.name,
                session,
                session.optimalMealInsulins,
                session.snapshot.readings.length
              );
            return <SessionGraph session={session} key={j} />;
          })}
        </Card>
      ))}
    </>
  );
}
