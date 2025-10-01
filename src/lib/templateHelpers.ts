import type Session from "../models/session";
import { CalibrationStore } from "../storage/calibrationStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { round } from "./util";

export function insulinRuleEngine(session: Session) {
  /**
   * This is a rule engine to determine if timing was right, too late, or too early
   * It also determines if insulin dose was too high or too low
   * It assumes that glucose was corrected when sugar goes too low
   *
   * We determine the insulin dosing very easily. All we do is compare it to the calculated correct meal insulin dosing
   * to the actual dose taken (we also account for correction for initial BG). If they are similar (within some error),
   * we consider it optimal. If it deviates significantly, it's either too much or too little.
   *
   * Rule engine -
   *
   * Assume optimal parameters unless otherwise determined
   *
   * If dosing is correct:
   * -> Dosing was well-timed (or late) if no (or minimal) glucose was taken to correct for lows
   * -> Dosing was too early if user took glucose
   *
   * If dosing is too low:
   * -> If any glucose was taken, timing was [too early]
   * -> If not, timing was either [optimal] or too late
   *
   * If dosing is too high:
   * -> It is impossible to determine timing.
   *
   * If multiple insulin doses were taken, it's impossible to determine timing
   */
  // Defining some constants
  const OPTIMAL = 0; // Just right
  const HIGH = 1; // Late or too much
  const LOW = -1; // Early or too little

  // Assume things are optimal unless proven otherwise
  let amount = OPTIMAL;
  let timing = OPTIMAL;

  // Some nice stuff to define
  const lowBG = PreferencesStore.lowBG.value;

  const takenInsulin = session.mealInsulin;
  const optimalInsulin = session.optimalMealInsulin;
  const insulinMaxThreshold =
    optimalInsulin +
    (PreferencesStore.targetBG.value - lowBG) /
      CalibrationStore.insulinEffect.value;
  // If insulin excess would have dropped you below the low threshold, it's too much

  // Rule engine magic
  if (takenInsulin < optimalInsulin) {
    amount = LOW;
  } else if (takenInsulin > insulinMaxThreshold) amount = HIGH;

  // Timing
  const glucose = session.glucose;
  const glucoseThreshold =
    (PreferencesStore.targetBG.value - lowBG) /
    CalibrationStore.glucoseEffect.value; // Set the threshold at whatever is required to bounce from low
  const glucoseExcess: boolean = glucose > glucoseThreshold;
  /** It's normal for you to have to correct down to a certain amount
   * We wanna give enough error where our user doesn't dip down below lowBG. If he had to take more than what's
   * required to bounce, we consider it too much
   */

  if (session.insulins.length < 2) {
    if (glucoseExcess) {
      if (amount === OPTIMAL || amount === LOW) timing = LOW;
    }
    if (session.initialGlucose && session.peakGlucose)
      if (
        timing !== LOW &&
        session.peakGlucose - session.initialGlucose >
          PreferencesStore.highBG.value - PreferencesStore.targetBG.value
      )
        timing = HIGH; // If our blood sugar would have gone to the high threshold, we consider it too late
  }

  return {
    amount,
    timing,
  };
}

// Misc helper functions
export function sessionsWeightedAverage(
  f: (s: any) => number,
  sessions: Session[]
) {
  const sessionHalfLife = PreferencesStore.sessionHalfLife.value;
  const maxSessionLife = PreferencesStore.maxSessionLife.value;
  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    if (session.isInvalid) continue;
    const age = session.age;
    if (age > maxSessionLife) break;
    const weight = Math.pow(0.5, age / sessionHalfLife);
    weightedSum += f(session) * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

// Multi-session interpreters
export function insulinDosingRecommendation(sessions: Session[]) {
  // We only account for meal insulin taken, subtracting whatever was used to correct
  let amountSuggestion = 0;
  let timingSuggestion = 0;
  try {
    amountSuggestion = round(
      sessionsWeightedAverage((s) => insulinRuleEngine(s).amount, sessions),
      1
    );
    timingSuggestion = round(
      sessionsWeightedAverage((s) => insulinRuleEngine(s).timing, sessions),
      1
    );
  } catch (e) {
    console.error(e);
  }

  return {
    amountSuggestion,
    timingSuggestion,
    amountAdjustment:
      -amountSuggestion * PreferencesStore.insulinStepSize.value,
    timingAdjustment: -timingSuggestion * PreferencesStore.timeStepSize.value,
  };
}
