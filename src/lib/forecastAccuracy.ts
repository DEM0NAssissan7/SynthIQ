/**
 * Replays every past session dose by dose to see what forecastUnits would've suggested
 * using only what was knowable at the time, then measures it against hindsight.
 *
 * Nothing here writes to storage: sessions are deep copied before use.
 */

import type Glucose from "../models/events/glucose";
import type Insulin from "../models/events/insulin";
import MealTemplate from "../models/mealTemplate";
import Session from "../models/session";
import type { InsulinVariant } from "../models/types/insulinVariant";
import type { RescueVariant } from "../models/types/rescueVariant";
import type { UUID } from "../models/types/types";
import { PreferencesStore } from "../storage/preferencesStore";
import { createWindows } from "./helpers/createWindow";
import { forecastUnits, retrospectiveForecast } from "./insulinOptimizer";
import { InsulinRetrospectiveOptimizer } from "./insulinRetrospectiveAnalyzer";
import { getHourDiff } from "./timing";

const CLOSE_BASE_CARBS = 10; // Grams of carb difference that still counts as a close base
const LANDING_RANGE = 30; // mg/dL either side of target that counts as a good landing

export type Suggestion = "forecast" | "hindsight" | "balancer" | "actual";

export interface DoseOutcome {
  landing: number; // BG at the end of the dose's effect (or of the session)
  min: number;
  timeBelowLow: number; // Fraction of the readings below lowBG
}

export interface DoseRecord {
  sessionUUID: UUID;
  sessionTime: number;
  foods: string;
  doseIndex: number;
  doseCount: number;
  hoursIn: number;
  variant: string;
  BG: number;
  actual: number;
  forecast: number;
  hindsight: number;
  balancer: number | null;
  baseTime: number;
  baseAgeDays: number;
  carbsDiff: number;
  proteinDiff: number;
  outcomes: Record<Suggestion, DoseOutcome | null>;
}

export interface Comparison {
  predicted: Suggestion;
  reference: Suggestion;
  segment: string;
  n: number;
  bias: number;
  mae: number;
  rmse: number;
  medianAbsError: number;
  p90AbsError: number;
  withinHalfUnit: number;
  withinOneUnit: number;
  within20Percent: number;
  correlation: number | null;
  overRate: number; // More than 0.5u above the reference
  underRate: number; // More than 0.5u below the reference
}

export interface OutcomeSummary {
  suggestion: Suggestion;
  n: number;
  meanLandingError: number;
  medianLandingError: number;
  landedInRange: number;
  meanMinBG: number;
  wentLow: number; // Fraction of doses where BG went below lowBG
  meanTimeBelowLow: number;
}

export interface BaseQuality {
  n: number;
  meanAbsCarbsDiff: number;
  meanAbsProteinDiff: number;
  meanBaseAgeDays: number;
  errorVsCarbsCorrelation: number | null; // |forecast - hindsight| against |carbs difference|
}

export interface ForecastAccuracyReport {
  targetBG: number;
  lowBG: number;
  safeLowBG: number; // lowBG + buffer, which is what the algorithms dose against
  totalSessions: number;
  analyzedSessions: number;
  skipped: Record<string, number>;
  doses: DoseRecord[];
  comparisons: Comparison[];
  outcomes: OutcomeSummary[];
  baseQuality: BaseQuality;
}

// The time-dependent parts of base selection (session age, expiry) read the current time
function withClock<T>(now: Date, fn: () => T): T {
  const RealDate = Date;
  const time = now.getTime();
  class ClockDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(time);
      else super(...(args as [number]));
    }
    static now() {
      return time;
    }
  }
  globalThis.Date = ClockDate as DateConstructor;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

function selectBaseSession(session: Session, pool: Session[]): Session | null {
  const template = new MealTemplate("Forecast accuracy");
  // Only sessions that had completely finished by the time this one started
  template._sessions = pool.filter(
    (s) =>
      s.uuid !== session.uuid &&
      s.snapshot.readings.length > 0 &&
      s.snapshot.endTime.getTime() < session.timestamp.getTime(),
  );
  return withClock(session.timestamp, () =>
    template.getBaseSession(session.meal!, session.timestamp),
  );
}

const identity = <T>(value: T) => value;

function solveBalancer(
  session: Session,
  doses: Insulin[],
  targetBG: number,
  lowBG: number,
): (number | null)[] {
  try {
    const windows = createWindows(doses, session.snapshot, session.glucoses);
    if (windows.length !== doses.length) return doses.map(() => null);
    const [insulins] = InsulinRetrospectiveOptimizer.balance(
      doses,
      windows,
      targetBG,
      lowBG,
      identity<InsulinVariant>,
      identity<RescueVariant>,
    );
    return insulins.map((insulin) => Math.max(0, insulin.value));
  } catch {
    return doses.map(() => null);
  }
}

// What the real trace would've done had this one dose been `units` instead
function simulateOutcome(
  session: Session,
  dose: Insulin,
  units: number | null,
  lowBG: number,
): DoseOutcome | null {
  if (units === null) return null;
  const start = dose.timestamp.getTime();
  const horizon = dose.variant.duration;
  const trace = session.snapshot.readings
    .map((reading) => ({
      sugar: reading.sugar,
      hours: getHourDiff(reading.timestamp, dose.timestamp),
      time: reading.timestamp.getTime(),
    }))
    .filter((r) => r.time > start && r.hours <= horizon)
    .sort((a, b) => a.time - b.time)
    .map(
      (r) =>
        r.sugar -
        dose.variant.effect *
          (units - dose.value) *
          dose.variant.unitBatemanIntegral(0, r.hours),
    );
  if (trace.length === 0) return null;
  return {
    landing: trace[trace.length - 1],
    min: Math.min(...trace),
    timeBelowLow: trace.filter((bg) => bg < lowBG).length / trace.length,
  };
}

function analyzeSession(
  session: Session,
  base: Session,
  targetBG: number,
  lowBG: number,
  safeLowBG: number,
): DoseRecord[] {
  const doses = [...session.insulins].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const refTimestamp = session.timestamp;
  const initialBG = session.initialGlucose!;
  const hindsight = retrospectiveForecast(session, targetBG, safeLowBG);
  const balancer = solveBalancer(session, doses, targetBG, safeLowBG);

  return doses.map((dose, doseIndex) => {
    const time = dose.timestamp.getTime();
    // Causal masking: only what had happened before this dose
    const takenInsulins = doses.filter((i) => i.timestamp.getTime() < time);
    const takenRescues: Glucose[] = session.glucoses.filter(
      (g) => g.timestamp.getTime() < time,
    );
    const BG = session.snapshot.getReading(dose.timestamp).sugar;
    const forecast = forecastUnits(
      base,
      takenInsulins,
      takenRescues,
      initialBG,
      BG,
      refTimestamp,
      dose.timestamp,
      dose.variant,
      targetBG,
      safeLowBG,
    );
    const suggested: Record<Suggestion, number | null> = {
      forecast,
      hindsight: hindsight[doseIndex].value,
      balancer: balancer[doseIndex],
      actual: dose.value,
    };
    const outcome = (suggestion: Suggestion) =>
      simulateOutcome(session, dose, suggested[suggestion], lowBG);

    return {
      sessionUUID: session.uuid,
      sessionTime: refTimestamp.getTime(),
      foods: (session.meal?.summedFoods ?? [])
        .map((f) => f.name)
        .slice(0, 3)
        .join(", "),
      doseIndex,
      doseCount: doses.length,
      hoursIn: getHourDiff(dose.timestamp, refTimestamp),
      variant: dose.variant.name,
      BG,
      actual: dose.value,
      forecast,
      hindsight: hindsight[doseIndex].value,
      balancer: balancer[doseIndex],
      baseTime: base.timestamp.getTime(),
      baseAgeDays:
        (refTimestamp.getTime() - base.timestamp.getTime()) / 86_400_000,
      carbsDiff: session.carbs - base.carbs,
      proteinDiff: session.protein - base.protein,
      outcomes: {
        forecast: outcome("forecast"),
        hindsight: outcome("hindsight"),
        balancer: outcome("balancer"),
        actual: outcome("actual"),
      },
    };
  });
}

// Statistics
const mean = (values: number[]) =>
  values.reduce((n, v) => n + v, 0) / values.length;
const quantile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
};
const fraction = (values: boolean[]) =>
  values.filter(Boolean).length / values.length;

function correlation(xs: number[], ys: number[]): number | null {
  if (xs.length < 2) return null;
  const meanX = mean(xs);
  const meanY = mean(ys);
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  xs.forEach((x, i) => {
    covariance += (x - meanX) * (ys[i] - meanY);
    varianceX += (x - meanX) ** 2;
    varianceY += (ys[i] - meanY) ** 2;
  });
  if (varianceX === 0 || varianceY === 0) return null;
  return covariance / Math.sqrt(varianceX * varianceY);
}

function compare(
  predicted: Suggestion,
  reference: Suggestion,
  segment: string,
  pairs: [number, number][],
): Comparison | null {
  if (pairs.length === 0) return null;
  const errors = pairs.map(([p, r]) => p - r);
  const absErrors = errors.map(Math.abs);
  return {
    predicted,
    reference,
    segment,
    n: pairs.length,
    bias: mean(errors),
    mae: mean(absErrors),
    rmse: Math.sqrt(mean(errors.map((e) => e ** 2))),
    medianAbsError: quantile(absErrors, 0.5),
    p90AbsError: quantile(absErrors, 0.9),
    withinHalfUnit: fraction(absErrors.map((e) => e <= 0.5)),
    withinOneUnit: fraction(absErrors.map((e) => e <= 1)),
    within20Percent: fraction(
      pairs.map(([p, r]) => Math.abs(p - r) <= 0.2 * Math.abs(r)),
    ),
    correlation: correlation(
      pairs.map(([p]) => p),
      pairs.map(([, r]) => r),
    ),
    overRate: fraction(errors.map((e) => e > 0.5)),
    underRate: fraction(errors.map((e) => e < -0.5)),
  };
}

const value = (dose: DoseRecord, suggestion: Suggestion) => dose[suggestion];

// Insulin given by this point. A forecast only ever advises on top of the real doses so far.
function cumulative(
  doses: DoseRecord[],
  index: number,
  suggestion: Suggestion,
): number | null {
  const dose = doses[index];
  const earlier = doses.filter((d) => d.doseIndex < dose.doseIndex);
  if (suggestion === "forecast")
    return dose.forecast + earlier.reduce((n, d) => n + d.actual, 0);
  let total = 0;
  for (const d of [...earlier, dose]) {
    const units = value(d, suggestion);
    if (units === null) return null;
    total += units;
  }
  return total;
}

const COMPARISON_PAIRS: [Suggestion, Suggestion][] = [
  ["forecast", "hindsight"],
  ["forecast", "balancer"],
  ["forecast", "actual"],
  ["actual", "hindsight"],
  ["actual", "balancer"],
  ["hindsight", "balancer"],
];

function buildComparisons(doses: DoseRecord[]): Comparison[] {
  const bySession = new Map<UUID, DoseRecord[]>();
  doses.forEach((d) =>
    bySession.set(d.sessionUUID, [
      ...(bySession.get(d.sessionUUID) ?? []),
      d,
    ]),
  );
  const segments: [string, (d: DoseRecord) => boolean][] = [
    ["All doses", () => true],
    ["First dose", (d) => d.doseIndex === 0],
    ["Later doses", (d) => d.doseIndex > 0],
    ["Close base", (d) => Math.abs(d.carbsDiff) <= CLOSE_BASE_CARBS],
    ["Far base", (d) => Math.abs(d.carbsDiff) > CLOSE_BASE_CARBS],
  ];

  const comparisons: (Comparison | null)[] = [];
  for (const [predicted, reference] of COMPARISON_PAIRS) {
    for (const [segment, include] of segments) {
      const pairs: [number, number][] = [];
      doses.filter(include).forEach((d) => {
        const r = value(d, reference);
        const p = value(d, predicted);
        if (r !== null && p !== null) pairs.push([p, r]);
      });
      comparisons.push(compare(predicted, reference, segment, pairs));
    }

    const cumulativePairs: [number, number][] = [];
    const totalPairs: [number, number][] = [];
    bySession.forEach((sessionDoses) =>
      sessionDoses.forEach((_, i) => {
        const p = cumulative(sessionDoses, i, predicted);
        const r = cumulative(sessionDoses, i, reference);
        if (p === null || r === null) return;
        cumulativePairs.push([p, r]);
        if (i === sessionDoses.length - 1) totalPairs.push([p, r]);
      }),
    );
    comparisons.push(
      compare(predicted, reference, "Cumulative by dose", cumulativePairs),
      compare(predicted, reference, "Session total", totalPairs),
    );
  }
  return comparisons.filter((c): c is Comparison => c !== null);
}

function buildOutcomes(
  doses: DoseRecord[],
  targetBG: number,
): OutcomeSummary[] {
  // Every suggestion is judged on the exact same doses, so the rows are comparable
  const suggestions: Suggestion[] = [
    "actual",
    "forecast",
    "hindsight",
    "balancer",
  ];
  const common = doses.filter((d) =>
    suggestions.every((s) => d.outcomes[s] !== null),
  );
  if (common.length === 0) return [];
  return suggestions.map((suggestion) => {
    const outcomes = common.map((d) => d.outcomes[suggestion]!);
    const landingErrors = outcomes.map((o) => Math.abs(o.landing - targetBG));
    return {
      suggestion,
      n: common.length,
      meanLandingError: mean(landingErrors),
      medianLandingError: quantile(landingErrors, 0.5),
      landedInRange: fraction(landingErrors.map((e) => e <= LANDING_RANGE)),
      meanMinBG: mean(outcomes.map((o) => o.min)),
      wentLow: fraction(outcomes.map((o) => o.timeBelowLow > 0)),
      meanTimeBelowLow: mean(outcomes.map((o) => o.timeBelowLow)),
    };
  });
}

function buildBaseQuality(doses: DoseRecord[]): BaseQuality {
  return {
    n: doses.length,
    meanAbsCarbsDiff: doses.length
      ? mean(doses.map((d) => Math.abs(d.carbsDiff)))
      : 0,
    meanAbsProteinDiff: doses.length
      ? mean(doses.map((d) => Math.abs(d.proteinDiff)))
      : 0,
    meanBaseAgeDays: doses.length ? mean(doses.map((d) => d.baseAgeDays)) : 0,
    errorVsCarbsCorrelation: correlation(
      doses.map((d) => Math.abs(d.forecast - d.hindsight)),
      doses.map((d) => Math.abs(d.carbsDiff)),
    ),
  };
}

export function analyzeForecastAccuracy(
  _sessions: Session[],
): ForecastAccuracyReport {
  const targetBG = PreferencesStore.targetBG.value;
  const lowBG = PreferencesStore.lowBG.value;
  const safeLowBG = lowBG + PreferencesStore.lowBuffer.value;

  const sessions = _sessions
    .map((s) => Session.deserialize(Session.serialize(s)))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  const doses: DoseRecord[] = [];
  let analyzedSessions = 0;

  for (const session of sessions) {
    if (session.isInvalid) skip("Invalid session");
    else if (session.initialGlucose === null) skip("No initial blood sugar");
    else if (session.snapshot.readings.length < 2) skip("Too few readings");
    else {
      try {
        const base = selectBaseSession(session, sessions);
        if (!base) {
          skip("No earlier base session");
          continue;
        }
        doses.push(
          ...analyzeSession(session, base, targetBG, lowBG, safeLowBG),
        );
        analyzedSessions++;
      } catch (error) {
        skip(`Analysis error: ${(error as Error).message}`);
      }
    }
  }

  return {
    targetBG,
    lowBG,
    safeLowBG,
    totalSessions: sessions.length,
    analyzedSessions,
    skipped,
    doses,
    comparisons: buildComparisons(doses),
    outcomes: buildOutcomes(doses, targetBG),
    baseQuality: buildBaseQuality(doses),
  };
}
