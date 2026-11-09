/**
 * Replays every past session dose by dose to see what the forecast would've suggested
 * using only what was knowable at the time.
 *
 * Accuracy is how close blood sugar would've stayed to target. We take the session's
 * real treatments out of its trace, leaving the meal curve, then apply the theoretical
 * insulin curves of each strategy's doses to it. Rescues are removed for every strategy,
 * so a dose that needed rescuing shows up as the low it would've been.
 *
 * Nothing here writes to storage: sessions are deep copied before use.
 */

import Insulin from "../models/events/insulin";
import MealTemplate from "../models/mealTemplate";
import Session from "../models/session";
import type { InsulinVariant } from "../models/types/insulinVariant";
import type { RescueVariant } from "../models/types/rescueVariant";
import type { UUID } from "../models/types/types";
import { PreferencesStore } from "../storage/preferencesStore";
import { createWindows } from "./helpers/createWindow";
import { getPlannedProfileRises } from "./insulinPipeline";
import {
  mealDeltaBG,
  replayForecast,
  retrospectiveForecast,
} from "./insulinOptimizer";
import { InsulinRetrospectiveOptimizer } from "./insulinRetrospectiveAnalyzer";
import { getHourDiff, getTimestampFromOffset } from "./timing";

const CLOSE_BASE_CARBS = 10; // Grams of difference that still count as a close base
const CLOSE_BASE_PROTEIN = 15;
const SEVERE_LOW_BG = 54;
const SCORE_STEP_HOURS = 5 / 60;

export type Suggestion = "forecast" | "hindsight" | "balancer" | "actual";

// Scored over the session, with times as fractions of it
export interface SessionOutcome {
  meanAbsFromTarget: number;
  meanFromTarget: number;
  timeInRange: number;
  timeBelowLow: number;
  timeAboveHigh: number;
  timeSevereLow: number;
  landingFromTarget: number;
  lowest: number;
  highest: number;
}

export interface SessionRecord {
  sessionUUID: UUID;
  sessionTime: number;
  foods: string;
  doseCount: number;
  matchingBase: boolean;
  baseCount: number; // How many past sessions the forecast averaged
  baseTime: number;
  outcomes: Record<Suggestion, SessionOutcome | null>;
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
  profileUnits: number; // The food adjustment included in the forecast
  hindsight: number;
  balancer: number | null;
  baseTime: number;
  baseAgeDays: number;
  matchingBase: boolean;
  baseCount: number;
  carbsDiff: number;
  proteinDiff: number;
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
  segment: string;
  suggestion: Suggestion;
  n: number;
  meanAbsFromTarget: number;
  meanFromTarget: number;
  meanAbsLanding: number;
  timeInRange: number;
  timeBelowLow: number;
  timeAboveHigh: number;
  timeSevereLow: number;
  wentLow: number; // Fraction of sessions that ever went below lowBG
  wentSevereLow: number;
  wentHigh: number;
}

export interface BaseQuality {
  n: number;
  meanAbsCarbsDiff: number;
  meanAbsProteinDiff: number;
  meanBaseAgeDays: number;
  meanBaseCount: number;
  matchingShare: number; // Fraction of doses whose base was the same meal
  errorVsCarbsCorrelation: number | null; // |forecast - hindsight| against |carbs difference|
  errorVsProteinCorrelation: number | null;
}

export interface ForecastAccuracyReport {
  targetBG: number;
  lowBG: number;
  highBG: number;
  safeLowBG: number; // lowBG + buffer, which is what the algorithms dose against
  totalSessions: number;
  analyzedSessions: number;
  skipped: Record<string, number>;
  sessions: SessionRecord[];
  doses: DoseRecord[];
  comparisons: Comparison[];
  outcomes: OutcomeSummary[];
  baseQuality: BaseQuality;
}

interface BGLimits {
  targetBG: number;
  lowBG: number;
  highBG: number;
  safeLowBG: number;
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

function selectBases(session: Session, pool: Session[]) {
  const template = new MealTemplate("Forecast accuracy");
  // Only sessions that had completely finished by the time this one started
  template._sessions = pool.filter(
    (s) =>
      s.uuid !== session.uuid &&
      s.snapshot.readings.length > 0 &&
      s.snapshot.endTime.getTime() < session.timestamp.getTime(),
  );
  return withClock(session.timestamp, () => ({
    bases: template.getBaseSessions(session.meal!, session.timestamp),
    profileBase: template.getBaseSession(session.meal!, session.timestamp),
  }));
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

// What the meal alone did to blood sugar, sampled evenly
function getMealCurve(session: Session) {
  const refTimestamp = session.timestamp;
  const start = Math.max(0, getHourDiff(session.snapshot.startTime, refTimestamp));
  const end = getHourDiff(session.snapshot.endTime, refTimestamp);
  const curve: { hours: number; BG: number }[] = [];
  for (let hours = start; hours <= end; hours += SCORE_STEP_HOURS) {
    curve.push({
      hours,
      BG:
        session.snapshot.getSmoothed(
          getTimestampFromOffset(refTimestamp, hours),
        ) +
        mealDeltaBG(
          0,
          hours,
          session.insulins,
          session.glucoses,
          null,
          refTimestamp,
        ),
    });
  }
  return curve;
}

function scoreDoses(
  mealCurve: ReturnType<typeof getMealCurve>,
  doses: Insulin[] | null,
  refTimestamp: Date,
  { targetBG, lowBG, highBG }: BGLimits,
): SessionOutcome | null {
  if (!doses || mealCurve.length === 0) return null;
  const trace = mealCurve.map(
    ({ hours, BG }) =>
      BG - mealDeltaBG(0, hours, doses, [], null, refTimestamp),
  );
  return {
    meanAbsFromTarget: mean(trace.map((bg) => Math.abs(bg - targetBG))),
    meanFromTarget: mean(trace.map((bg) => bg - targetBG)),
    timeInRange: fraction(trace.map((bg) => bg >= lowBG && bg <= highBG)),
    timeBelowLow: fraction(trace.map((bg) => bg < lowBG)),
    timeAboveHigh: fraction(trace.map((bg) => bg > highBG)),
    timeSevereLow: fraction(trace.map((bg) => bg < SEVERE_LOW_BG)),
    landingFromTarget: trace[trace.length - 1] - targetBG,
    lowest: Math.min(...trace),
    highest: Math.max(...trace),
  };
}

function analyzeSession(
  session: Session,
  bases: Session[],
  profileBase: Session,
  limits: BGLimits,
): { record: SessionRecord; doses: DoseRecord[] } {
  const { targetBG, safeLowBG } = limits;
  const doses = [...session.insulins].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const refTimestamp = session.timestamp;
  // The same food adjustment the app applies on top of the forecast
  const profileRises = getPlannedProfileRises(
    session.initialGlucose,
    session.meal!,
    profileBase,
  );
  const replayed = replayForecast(
    session,
    bases,
    targetBG,
    safeLowBG,
    profileRises,
  );
  // One bad session must not poison the averages of every other one
  if (replayed.some((d) => !Number.isFinite(d.insulin.value)))
    throw new Error("the forecast could not be calculated");
  const hindsight = retrospectiveForecast(
    session,
    [session],
    targetBG,
    safeLowBG,
  );
  const balancer = solveBalancer(session, doses, targetBG, safeLowBG);
  const balancerDoses = balancer.includes(null)
    ? null
    : doses.map(
        (d, i) => new Insulin(balancer[i]!, d.timestamp, d.variant),
      );

  const mealCurve = getMealCurve(session);
  const score = (plan: Insulin[] | null) =>
    scoreDoses(mealCurve, plan, refTimestamp, limits);

  const foods = [...new Set(session.meal!.addedFoods.map((f) => f.name))]
    .slice(0, 3)
    .join(", ");
  const matchingBase = session.meal!.matches(bases[0].meal!);
  const baseTime = Math.max(...bases.map((b) => b.timestamp.getTime())); // The newest base

  return {
    record: {
      sessionUUID: session.uuid,
      sessionTime: refTimestamp.getTime(),
      foods,
      doseCount: doses.length,
      matchingBase,
      baseCount: bases.length,
      baseTime,
      outcomes: {
        forecast: score(replayed.map((d) => d.insulin)),
        hindsight: score(hindsight),
        balancer: score(balancerDoses),
        actual: score(doses),
      },
    },
    doses: doses.map((dose, doseIndex) => ({
      sessionUUID: session.uuid,
      sessionTime: refTimestamp.getTime(),
      foods,
      doseIndex,
      doseCount: doses.length,
      hoursIn: getHourDiff(dose.timestamp, refTimestamp),
      variant: dose.variant.name,
      BG: replayed[doseIndex].BG,
      actual: dose.value,
      forecast: replayed[doseIndex].insulin.value,
      profileUnits: (profileRises[doseIndex] ?? 0) / dose.variant.effect,
      hindsight: hindsight[doseIndex].value,
      balancer: balancer[doseIndex],
      baseTime,
      baseAgeDays: (refTimestamp.getTime() - baseTime) / 86_400_000,
      matchingBase,
      baseCount: bases.length,
      carbsDiff: session.carbs - mean(bases.map((b) => b.carbs)),
      proteinDiff: session.protein - mean(bases.map((b) => b.protein)),
    })),
  };
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

// Insulin given by this point
function cumulative(
  doses: DoseRecord[],
  index: number,
  suggestion: Suggestion,
): number | null {
  const dose = doses[index];
  const earlier = doses.filter((d) => d.doseIndex < dose.doseIndex);
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

const isCloseBase = (d: DoseRecord) =>
  Math.abs(d.carbsDiff) <= CLOSE_BASE_CARBS &&
  Math.abs(d.proteinDiff) <= CLOSE_BASE_PROTEIN;

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
    ["Matching base", (d) => d.matchingBase],
    ["Different base", (d) => !d.matchingBase],
    ["Close base", isCloseBase],
    ["Far base", (d) => !isCloseBase(d)],
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

function buildOutcomes(sessions: SessionRecord[]): OutcomeSummary[] {
  const suggestions: Suggestion[] = [
    "actual",
    "forecast",
    "hindsight",
    "balancer",
  ];
  // Every strategy is judged on the exact same sessions, so the rows are comparable
  const common = sessions.filter((s) =>
    suggestions.every((suggestion) => s.outcomes[suggestion] !== null),
  );
  const segments: [string, SessionRecord[]][] = [
    ["All sessions", common],
    ["Matching base", common.filter((s) => s.matchingBase)],
    ["Different base", common.filter((s) => !s.matchingBase)],
  ];

  const summaries: OutcomeSummary[] = [];
  for (const [segment, included] of segments) {
    if (included.length === 0) continue;
    for (const suggestion of suggestions) {
      const outcomes = included.map((s) => s.outcomes[suggestion]!);
      const average = (pick: (o: SessionOutcome) => number) =>
        mean(outcomes.map(pick));
      summaries.push({
        segment,
        suggestion,
        n: included.length,
        meanAbsFromTarget: average((o) => o.meanAbsFromTarget),
        meanFromTarget: average((o) => o.meanFromTarget),
        meanAbsLanding: average((o) => Math.abs(o.landingFromTarget)),
        timeInRange: average((o) => o.timeInRange),
        timeBelowLow: average((o) => o.timeBelowLow),
        timeAboveHigh: average((o) => o.timeAboveHigh),
        timeSevereLow: average((o) => o.timeSevereLow),
        wentLow: fraction(outcomes.map((o) => o.timeBelowLow > 0)),
        wentSevereLow: fraction(outcomes.map((o) => o.lowest < SEVERE_LOW_BG)),
        wentHigh: fraction(outcomes.map((o) => o.timeAboveHigh > 0)),
      });
    }
  }
  return summaries;
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
    meanBaseCount: doses.length ? mean(doses.map((d) => d.baseCount)) : 0,
    matchingShare: doses.length
      ? fraction(doses.map((d) => d.matchingBase))
      : 0,
    errorVsCarbsCorrelation: correlation(
      doses.map((d) => Math.abs(d.forecast - d.hindsight)),
      doses.map((d) => Math.abs(d.carbsDiff)),
    ),
    errorVsProteinCorrelation: correlation(
      doses.map((d) => Math.abs(d.forecast - d.hindsight)),
      doses.map((d) => Math.abs(d.proteinDiff)),
    ),
  };
}

export function analyzeForecastAccuracy(
  _sessions: Session[],
): ForecastAccuracyReport {
  const lowBG = PreferencesStore.lowBG.value;
  const limits: BGLimits = {
    targetBG: PreferencesStore.targetBG.value,
    lowBG,
    highBG: PreferencesStore.highBG.value,
    safeLowBG: lowBG + PreferencesStore.lowBuffer.value,
  };

  const allSessions = _sessions
    .map((s) => Session.deserialize(Session.serialize(s)))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  // Without a measurable meal rise a session can't be tested or be a base. We're testing
  // the algorithm here, not how well the profile guesses in its place.
  const sessions = allSessions.filter((s) => {
    const usable = Number.isFinite(s.mealRise);
    if (!usable) skip("No usable meal rise");
    return usable;
  });
  const records: SessionRecord[] = [];
  const doses: DoseRecord[] = [];

  for (const session of sessions) {
    if (session.isInvalid) skip("Invalid session");
    else if (session.initialGlucose === null) skip("No initial blood sugar");
    else if (session.snapshot.readings.length < 2) skip("Too few readings");
    else {
      try {
        const { bases, profileBase } = selectBases(session, sessions);
        if (!profileBase || bases.length === 0) {
          skip("No earlier base session");
          continue;
        }
        const analysis = analyzeSession(session, bases, profileBase, limits);
        records.push(analysis.record);
        doses.push(...analysis.doses);
      } catch (error) {
        skip(`Analysis error: ${(error as Error).message}`);
      }
    }
  }

  return {
    ...limits,
    totalSessions: allSessions.length,
    analyzedSessions: records.length,
    skipped,
    sessions: records,
    doses,
    comparisons: buildComparisons(doses),
    outcomes: buildOutcomes(records),
    baseQuality: buildBaseQuality(doses),
  };
}
