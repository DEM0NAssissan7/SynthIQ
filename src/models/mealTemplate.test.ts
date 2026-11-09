import { describe, expect, it } from "vitest";
import "../storage/wizardStore"; // Must load first: it has a circular import with Session
import Meal from "./events/meal";
import Food from "./food";
import MealTemplate from "./mealTemplate";
import Session from "./session";
import { InsulinVariant } from "./types/insulinVariant";
import SugarReading from "./types/sugarReading";

const HOUR_MS = 3_600_000;
const variant = new InsulinVariant("Test", 50, 28, 2, 0.8);

function daysAgo(days: number, hour = 12) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function createMeal(amounts: Record<string, number>, timestamp = new Date()) {
  const meal = new Meal(timestamp);
  Object.entries(amounts).forEach(([name, amount]) => {
    const food = new Food(name, 50, 5);
    food.amount = amount;
    meal.addFood(food);
  });
  return meal;
}

function createSession(amounts: Record<string, number>, timestamp: Date) {
  const session = new Session();
  session.addMeal(createMeal(amounts, timestamp));
  session.createInsulin(5, timestamp, variant);
  [0, 5].forEach((hours) =>
    session.snapshot.addReading(
      new SugarReading(100, new Date(timestamp.getTime() + hours * HOUR_MS), true),
    ),
  );
  return session;
}

function createTemplate(...sessions: Session[]) {
  const template = new MealTemplate("Test");
  template._sessions = sessions;
  return template;
}

describe("getBaseSession", () => {
  const meal = { Rice: 100, Steak: 200 };
  const similar = { Rice: 110, Steak: 200 };

  it("prefers an identical meal over a more recent similar one", () => {
    const identical = createSession(meal, daysAgo(5));
    const template = createTemplate(identical, createSession(similar, daysAgo(1)));
    expect(template.getBaseSession(createMeal(meal), daysAgo(0))).toBe(identical);
  });

  it("uses an old identical meal even when newer sessions exist", () => {
    const identical = createSession(meal, daysAgo(60));
    const template = createTemplate(identical, createSession(similar, daysAgo(1)));
    expect(template.getBaseSession(createMeal(meal), daysAgo(0))).toBe(identical);
  });

  it("picks the identical meal closest in time of day, then the most recent", () => {
    const morning = createSession(meal, daysAgo(1, 7));
    const olderNoon = createSession(meal, daysAgo(8, 12));
    const newerNoon = createSession(meal, daysAgo(4, 12));
    const template = createTemplate(morning, olderNoon, newerNoon);
    expect(template.getBaseSession(createMeal(meal), daysAgo(0, 12))).toBe(
      newerNoon,
    );
  });

  it("falls back to the most similar meal when none are identical", () => {
    const close = createSession(similar, daysAgo(2));
    const far = createSession({ Pasta: 400 }, daysAgo(3));
    const template = createTemplate(close, far);
    expect(template.getBaseSession(createMeal(meal), daysAgo(0))).toBe(close);
  });

  it("counts amounts within 5% as the same meal", () => {
    const near = createSession({ Rice: 104, Steak: 196 }, daysAgo(5));
    const template = createTemplate(near, createSession(similar, daysAgo(1)));
    expect(template.getBaseSession(createMeal(meal), daysAgo(0))).toBe(near);
  });

  it("does not count amounts more than 5% away as the same meal", () => {
    const base = createMeal(meal);
    expect(base.matches(createMeal({ Rice: 106, Steak: 200 }))).toBe(false);
    expect(base.matches(createMeal({ Rice: 105, Steak: 200 }))).toBe(true);
  });

  it("matches on food amounts, not nutrition", () => {
    expect(
      createMeal({ Rice: 100 }).matches(createMeal({ Pasta: 100 })),
    ).toBe(false);
  });

  it("uses every matching session as a base", () => {
    const older = createSession(meal, daysAgo(9, 7));
    const newer = createSession(meal, daysAgo(2));
    const template = createTemplate(older, newer, createSession(similar, daysAgo(1)));
    expect(template.getBaseSessions(createMeal(meal), daysAgo(0))).toEqual([
      older,
      newer,
    ]);
  });

  it("uses the one most similar session when nothing matches", () => {
    const close = createSession(similar, daysAgo(2));
    const template = createTemplate(close, createSession({ Pasta: 400 }, daysAgo(3)));
    expect(template.getBaseSessions(createMeal(meal), daysAgo(0))).toEqual([close]);
  });

  it("does not treat a meal with extra food as identical", () => {
    const smaller = createMeal({ Rice: 100 });
    const larger = createMeal({ Rice: 100, Steak: 200 });
    expect(larger.isIdentical(smaller)).toBe(false);
    expect(smaller.isIdentical(larger)).toBe(false);
  });
});
