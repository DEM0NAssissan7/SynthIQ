import Card from "../components/Card";
import { getOptimalMealInsulins } from "../lib/metabolism";
import { getFullPrettyDate } from "../lib/timing";
import type MealTemplate from "../models/mealTemplate";
import type Session from "../models/session";
import { WizardStore } from "../storage/wizardStore";

export default function HistoryPage() {
  return (
    <>
      {WizardStore.templates.value.map((template: MealTemplate, i) => (
        <Card key={i}>
          <h1>{template.name}</h1>
          <table style={{ width: "100%", marginBottom: "1rem" }}>
            <thead>
              <tr>
                <th>UUID</th>
                <th>Time</th>
                <th>Carbs (g)</th>
                <th>Protein (g)</th>
                <th>Insulin [correction] (u)</th>
                <th>BG info [delta] (mg/dL)</th>
                <th>Glucose (g)</th>
                <th>Optimal Meal Insulin (u)</th>
              </tr>
            </thead>
            {[...template.sessions].reverse().map((session: Session) => {
              if (session.meals.length < 1 || session.isGarbage) return <></>;
              console.log(
                template.name,
                session,
                getOptimalMealInsulins(session)
              );
              return (
                <tbody>
                  <tr>
                    <td>{session.uuid}</td>
                    <td>{`${getFullPrettyDate(session.timestamp)}`}</td>
                    <td>{session.carbs.toFixed()}</td>
                    <td>{session.protein.toFixed()}</td>
                    <td>
                      {session.insulin}{" "}
                      {session.correctionInsulin > 0 &&
                        `[${session.correctionInsulin.toFixed(1)}
                      ]`}
                    </td>
                    <td>
                      {session.initialGlucose} {"->"} {session.finalBG}{" "}
                      <b>
                        [{session.deltaGlucose > 0 ? "+" : ""}
                        {session.deltaGlucose}]
                      </b>
                    </td>
                    <td>{session.glucose}</td>
                    <td>{session.optimalMealInsulin.toFixed(1)}</td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        </Card>
      ))}
    </>
  );
}
