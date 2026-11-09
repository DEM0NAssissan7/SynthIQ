import { describe, expect, it } from "vitest";
import "../storage/wizardStore"; // Must load first: it has a circular import with Session
import Meal from "../models/events/meal";
import Session from "../models/session";
import Food from "../models/food";
import { InsulinVariant } from "../models/types/insulinVariant";
import { RescueVariant } from "../models/types/rescueVariant";
import SugarReading from "../models/types/sugarReading";
import { PreferencesStore } from "../storage/preferencesStore";
import { analyzeForecastAccuracy } from "./forecastAccuracy";

const HOUR_MS = 3_600_000;
const DAY_HOURS = 24;
const start = new Date("2026-01-01T12:00:00Z").getTime();
const variant = new InsulinVariant("Test", 50, 28, 2, 0.8);
const rescue = new RescueVariant("Test", 15, 1, 5);
const TARGET = PreferencesStore.targetBG.value;

interface SessionOptions {
  day: number;
  doses: [number, number][]; // [hours, units]
  readings: [number, number][]; // [hours, BG]
  foodAmount?: number;
}

function createSession({
  day,
  doses,
  readings,
  foodAmount = 100,
}: SessionOptions) {
  const offset = start + day * DAY_HOURS * HOUR_MS;
  const at = (hours: number) => new Date(offset + hours * HOUR_MS);
  const session = new Session();
  const meal = new Meal(at(0));
  const food = new Food("Toast", 50, 5);
  food.amount = foodAmount;
  meal.addFood(food);
  session.addMeal(meal);
  doses.forEach(([hours, units]) =>
    session.createInsulin(units, at(hours), variant),
  );
  readings.forEach(([hours, BG], i) =>
    session.snapshot.addReading(
      new SugarReading(BG, at(hours), i === 0 || i === readings.length - 1),
    ),
  );
  return session;
}

const baseOptions: SessionOptions = {
  day: 0,
  doses: [
    [0, 5],
    [2, 2],
  ],
  readings: [
    [0, 110],
    [1, 160],
    [2, 170],
    [3, 150],
    [4, 125],
    [5, 110],
  ],
};
const targetOptions: SessionOptions = { ...baseOptions, day: 3 };

describe("analyzeForecastAccuracy", () => {
  it("only ever selects a base session that had finished", () => {
    const first = createSession(baseOptions);
    const target = createSession(targetOptions);
    const later = createSession({ ...baseOptions, day: 6 });

    const { doses, skipped } = analyzeForecastAccuracy([later, target, first]);

    expect(skipped["No earlier base session"]).toBe(1);
    const targetDoses = doses.filter((d) => d.sessionUUID === target.uuid);
    expect(targetDoses).toHaveLength(2);
    targetDoses.forEach((d) =>
      expect(d.baseTime).toBe(first.timestamp.getTime()),
    );
  });

  it("averages every matching earlier session", () => {
    const report = analyzeForecastAccuracy([
      createSession(baseOptions),
      createSession({ ...baseOptions, day: 1 }),
      createSession({ ...baseOptions, day: 2 }),
    ]);
    const last = report.sessions[report.sessions.length - 1];
    expect(last.baseCount).toBe(2);
    expect(last.matchingBase).toBe(true);
  });

  it("adds the food adjustment when a meal is bigger than its base", () => {
    const firstForecast = (foodAmount: number) => {
      const target = createSession({ ...targetOptions, foodAmount });
      const report = analyzeForecastAccuracy([
        createSession(baseOptions),
        target,
      ]);
      return report.doses.find(
        (d) => d.sessionUUID === target.uuid && d.doseIndex === 0,
      )!;
    };
    const sameMeal = firstForecast(100);
    const biggerMeal = firstForecast(150);

    expect(sameMeal.profileUnits).toBeCloseTo(0, 5);
    expect(biggerMeal.profileUnits).toBeGreaterThan(0);
    expect(biggerMeal.forecast).toBeGreaterThan(sameMeal.forecast);
  });

  it("leaves sessions with no usable meal rise out completely", () => {
    const unusable = createSession({
      ...baseOptions,
      readings: [[0, 0], ...baseOptions.readings.slice(1)],
    });
    const base = createSession({ ...baseOptions, day: 1 });
    const target = createSession(targetOptions);

    const report = analyzeForecastAccuracy([unusable, base, target]);

    expect(report.skipped["No usable meal rise"]).toBe(1);
    expect(report.sessions.map((s) => s.sessionUUID)).toEqual([target.uuid]);
    expect(report.sessions[0].baseCount).toBe(1);
    expect(report.totalSessions).toBe(3);
  });

  it("does not let a dose's forecast see anything after that dose", () => {
    const forecastsFor = (options: SessionOptions) => {
      const target = createSession(options);
      return analyzeForecastAccuracy([createSession(baseOptions), target]).doses
        .filter((d) => d.sessionUUID === target.uuid)
        .map((d) => d.forecast);
    };

    const original = forecastsFor(targetOptions);
    const changedFuture = forecastsFor({
      ...targetOptions,
      doses: [
        [0, 5],
        [2, 9], // A very different later dose...
      ],
      readings: [
        [0, 110],
        [1, 160],
        [2, 170],
        [3, 240], // ...and a very different future
        [4, 260],
        [5, 230],
      ],
    });

    expect(original.length).toBe(2);
    expect(changedFuture).toEqual(original);
  });

  it("does not modify the sessions it is given", () => {
    const sessions = [createSession(baseOptions), createSession(targetOptions)];
    const before = sessions.map((s) => JSON.stringify(Session.serialize(s)));

    analyzeForecastAccuracy(sessions);

    expect(sessions.map((s) => JSON.stringify(Session.serialize(s)))).toEqual(
      before,
    );
  });

  it("measures the forecast against every reference", () => {
    const report = analyzeForecastAccuracy([
      createSession(baseOptions),
      createSession(targetOptions),
    ]);

    expect(report.analyzedSessions).toBe(1);
    for (const reference of ["hindsight", "balancer", "actual"]) {
      const all = report.comparisons.find(
        (c) =>
          c.predicted === "forecast" &&
          c.reference === reference &&
          c.segment === "All doses",
      );
      expect(all?.n).toBe(2);
      expect(Number.isFinite(all?.mae)).toBe(true);
    }
    expect(
      report.outcomes
        .filter((o) => o.segment === "All sessions")
        .map((o) => o.suggestion),
    ).toEqual(["actual", "forecast", "hindsight", "balancer"]);
  });

  const flatSession = (day: number, glucose = 0) => {
    const session = createSession({
      day,
      doses: [[0, 5]],
      readings: [
        [0, TARGET],
        [5, TARGET],
      ],
    });
    if (glucose > 0)
      session.createGlucose(
        glucose,
        new Date(session.timestamp.getTime() + 2 * HOUR_MS),
        rescue,
      );
    return session;
  };
  const actualOutcome = (glucose: number) => {
    const target = flatSession(3, glucose);
    const report = analyzeForecastAccuracy([flatSession(0), target]);
    return report.sessions.find((s) => s.sessionUUID === target.uuid)!.outcomes
      .actual!;
  };

  it("scores the real doses as what really happened", () => {
    const outcome = actualOutcome(0);
    expect(outcome.meanAbsFromTarget).toBeCloseTo(0, 5);
    expect(outcome.timeInRange).toBe(1);
  });

  it("shows a rescued dose as the low it would've been", () => {
    const outcome = actualOutcome(10);
    expect(outcome.lowest).toBeCloseTo(TARGET - 50, 5);
    expect(outcome.timeBelowLow).toBeGreaterThan(0);
  });
});
