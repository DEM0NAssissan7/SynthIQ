import { describe, expect, it } from "vitest";
import "../storage/wizardStore"; // Must load first: it has a circular import with Session
import Meal from "../models/events/meal";
import Session from "../models/session";
import { InsulinVariant } from "../models/types/insulinVariant";
import SugarReading from "../models/types/sugarReading";
import { createWindows } from "./helpers/createWindow";
import { retrospectiveForecast } from "./insulinOptimizer";
import { InsulinRetrospectiveOptimizer } from "./insulinRetrospectiveAnalyzer";

const HOUR_MS = 3_600_000;
const TOLERANCE_UNITS = 0.05;
const TARGET_BG = 110;
const LOW_BG = 70;

const t0 = new Date("2026-01-01T12:00:00Z");
const at = (hours: number) => new Date(t0.getTime() + hours * HOUR_MS);
const variant = new InsulinVariant("Test", 50, 28, 2, 0.8);

interface Scenario {
  name: string;
  doses: [number, number][]; // [hours, units]
  readings: [number, number][]; // [hours, BG], one per window boundary
}

const scenarios: Scenario[] = [
  {
    name: "three doses, starting at target",
    doses: [
      [0, 4],
      [1.5, 2],
      [3, 1],
    ],
    readings: [
      [0, 110],
      [1.5, 170],
      [3, 150],
      [6, 105],
    ],
  },
  {
    name: "two doses, starting above target",
    doses: [
      [0, 5],
      [2, 3],
    ],
    readings: [
      [0, 130],
      [2, 190],
      [5, 120],
    ],
  },
];

function createSession({ doses, readings }: Scenario) {
  const session = new Session();
  session.addMeal(new Meal(t0));
  doses.forEach(([hours, units]) =>
    session.createInsulin(units, at(hours), variant),
  );
  readings.forEach(([hours, BG], i) =>
    session.snapshot.addReading(new SugarReading(BG, at(hours), i === 0)),
  );
  session.initialGlucose = readings[0][1];
  return session;
}

function solveBalance(session: Session) {
  const windows = createWindows(session.insulins, session.snapshot, []);
  const [insulins] = InsulinRetrospectiveOptimizer.balance(
    session.insulins,
    windows,
    TARGET_BG,
    LOW_BG,
    (v) => v,
    (v) => v,
  );
  return insulins.map((insulin) => Math.max(0, insulin.value)); // Manual cap, matching forecastUnits
}

describe("forecastUnits matches balance", () => {
  it.each(scenarios)("$name", (scenario) => {
    const session = createSession(scenario);
    const balanced = solveBalance(session);
    const forecast = retrospectiveForecast(session, TARGET_BG, LOW_BG).map(
      (insulin) => insulin.value,
    );

    const results = balanced.map((units, i) => ({
      hours: scenario.doses[i][0],
      balance: Number(units.toFixed(3)),
      forecast: Number(forecast[i].toFixed(3)),
      difference: Number((forecast[i] - units).toFixed(3)),
    }));
    console.log(`${scenario.name}\n${JSON.stringify(results, null, 2)}`);

    results.forEach(({ difference }) =>
      expect(Math.abs(difference)).toBeLessThanOrEqual(TOLERANCE_UNITS),
    );
  });
});
