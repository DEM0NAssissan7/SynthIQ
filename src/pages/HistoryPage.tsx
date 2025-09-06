import Card from "../components/Card";
import { getOptimalMealInsulins } from "../lib/metabolism";
import { getPrettyTime } from "../lib/timing";
import type MealTemplate from "../models/mealTemplate";
import type Session from "../models/session";
import { CalibrationStore } from "../storage/calibrationStore";
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
                <th>Time</th>
                <th>Carbs (g)</th>
                <th>Protein (g)</th>
                <th>Initial BG (mg/dL)</th>
                <th>Final BG (mg/dL)</th>
                <th>Delta (mg/dL)</th>
                <th>Insulin (u)</th>
                <th>Glucose (g)</th>
                <th>Insulin Adjustment (u)</th>
                <th>Optimal Meal Insulin (u)</th>
                <th>ISF (pts/u)</th>
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
                    <td>
                      {`${getPrettyTime(session.timestamp)} (${
                        session.timestamp.getMonth() + 1
                      }-${session.timestamp.getDate()})`}
                    </td>
                    <td>{session.carbs.toFixed()}</td>
                    <td>{session.protein.toFixed()}</td>
                    <td>{session.initialGlucose}</td>
                    <td>
                      {session.finalBG} ( -
                      {(
                        session.glucose * CalibrationStore.glucoseEffect.value
                      ).toFixed()}
                      )
                    </td>
                    <td>
                      {session.deltaGlucose > 0 ? "+" : ""}
                      {session.deltaGlucose}
                    </td>
                    <td>{session.insulin}</td>
                    <td>{session.glucose}</td>
                    <td>{`${
                      session.insulinAdjustment > 0 ? "+" : ""
                    }${session.insulinAdjustment.toFixed(1)}`}</td>
                    <td>{session.optimalMealInsulin.toFixed(1)}</td>
                    <td>{session.insulinEffect}</td>
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
