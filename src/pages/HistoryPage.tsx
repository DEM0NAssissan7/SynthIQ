import { ToggleButton } from "react-bootstrap";
import Card from "../components/Card";
import { getFullPrettyDate } from "../lib/timing";
import type MealTemplate from "../models/mealTemplate";
import type Session from "../models/session";
import { WizardStore } from "../storage/wizardStore";
import { useState } from "react";

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
                <th>Score</th>
                <th>Optimal Meal Insulin (u)</th>
              </tr>
            </thead>
            {[...template.sessions].reverse().map((session: Session) => {
              if (session.meals.length < 1) return <></>;
              const [, setRerenderFlag] = useState(false);
              console.log(template.name, session, session.optimalMealInsulins);
              return (
                <tbody
                  style={
                    session.isInvalid
                      ? session.isGarbage
                        ? { backgroundColor: "rgba(255, 0, 0, 0.2)" }
                        : { backgroundColor: "rgba(229, 255, 0, 0.2)" }
                      : undefined
                  }
                >
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
                    <td>{session.score.toFixed(0)}</td>
                    <td>{session.optimalMealInsulin.toFixed(1)}</td>
                    <td>
                      <ToggleButton
                        id={`toggle-check-${session.uuid}`}
                        type="checkbox"
                        variant="outline-danger"
                        checked={session.isGarbage}
                        value="1"
                        size="sm"
                        style={{
                          padding: "2px 6px",
                          fontSize: "0.75rem",
                          lineHeight: "1",
                        }}
                        onChange={(e) => {
                          session.isGarbage = e.currentTarget.checked;
                          WizardStore.templates.write();
                          // Trigger rerender
                          setRerenderFlag((f) => !f);
                        }}
                      >
                        Garbage
                      </ToggleButton>
                    </td>
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
