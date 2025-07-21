import type Meal from "../models/events/meal";
import type MetabolismProfile from "../models/metabolism/metabolismProfile";
import type Session from "../models/session";
import type Template from "../models/template";
import Unit from "../models/unit";
import { profile } from "../storage/metaProfileStore";
import preferencesStore from "../storage/preferencesStore";
import { getCorrectionInsulin } from "./metabolism";
import { getHourDiff } from "./timing";
import { convertDimensions, MathUtil, round } from "./util";

// Basic Insulin Dosing Optimization
function getCorrectMealDosing(session: Session) {
  const finalBG = session.finalBG;
  if (!finalBG)
    throw new Error(
      `Cannot get insulin dosing: there is no final blood glucose`
    );
  const initialGlucose = session.initialGlucose;

  const totalDeltaBG = finalBG - initialGlucose;

  const glucose = session.glucose;
  const glucoseDeltaBG = glucose * profile.glucose.effect;

  const insulin = session.insulin;
  const insulinDeltaBG = insulin * profile.insulin.effect;

  /* 
  The following statement is true:
  totalDeltaBG = mealDeltaBG - insulinDeltaBG + glucoseDeltaBG

  -> Because, the total change in blood sugar is:
  The rise from the meal
  The fall from insulin
  The rise from glucoses

  Of course there's variance and other factors, but these are the major players, and all we can realistically measure

  so to rearrange to solve for effectMeal, we have:
  mealDeltaBG = totalDeltaBG + insulinDeltaBG - glucoseDeltaBG

  */
  const mealDeltaBG = totalDeltaBG + insulinDeltaBG - glucoseDeltaBG;

  const optimalMealInsulin = mealDeltaBG / profile.insulin.effect;
  return optimalMealInsulin;
}
export function getCorrectDosing(session: Session) {
  const optimalInsulin =
    getCorrectMealDosing(session) +
    getCorrectionInsulin(session.initialGlucose); // Account for BG correction
  return optimalInsulin;
}
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
  const lowBG = preferencesStore.get("lowBG");

  const takenInsulin = session.insulin;
  const optimalInsulin = getCorrectDosing(session);
  const insulinPercentError = MathUtil.percentError(
    optimalInsulin,
    takenInsulin
  );
  const percentErrorThreshold = 10;
  const insulinMaxThreshold =
    optimalInsulin + (profile.target - lowBG) / profile.insulin.effect;
  // If insulin excess would have dropped you below the low threshold, it's too much

  // Rule engine magic
  console.log(insulinPercentError, takenInsulin - optimalInsulin);
  if (takenInsulin < optimalInsulin) {
    if (insulinPercentError > percentErrorThreshold) amount = LOW;
  } else if (takenInsulin > insulinMaxThreshold) amount = HIGH;

  // Timing
  const glucose = session.glucose;
  const glucoseThreshold = (profile.target - lowBG) / profile.glucose.effect; // Set the threshold at whatever is required to bounce from 65mg/dL
  const glucoseExcess: boolean = glucose > glucoseThreshold;
  /** It's normal for you to have to correct down to a certain amount
   * We wanna give enough error where our user doesn't dip down below lowBG. If he had to take more than what's
   * required to bounce, we consider it too much
   */

  if (glucoseExcess && session.insulins.length < 2) {
    if (amount === OPTIMAL || amount === LOW) timing = LOW;
  }

  return {
    amount,
    timing,
  };
}
export function getProfileError(session: Session, profile: MetabolismProfile) {
  const calculatedRise =
    session.carbs * profile.carbs.effect +
    session.protein * profile.protein.effect;
  const actualMealRise = getCorrectMealDosing(session);
  const profileError = calculatedRise - actualMealRise;
  return profileError;
}

// Misc helper functions
function getSessionAge(session: Session) {
  const date = new Date();
  const hoursSince = getHourDiff(date, session.timestamp);
  const daysSince =
    hoursSince * convertDimensions(Unit.Time.Hour, Unit.Time.Day);
  return daysSince;
}
export function sessionsWeightedAverage(
  f: (s: any) => number,
  sessions: Session[]
) {
  const sessionHalfLife = preferencesStore.get("sessionHalfLife");
  const maxSessionLife = preferencesStore.get("maxSessionLife");
  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    const age = getSessionAge(session);
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
    console.log(amountSuggestion, timingSuggestion);
  } catch (e) {
    console.error(e);
  }

  return {
    amountSuggestion,
    timingSuggestion,
    amountAdjustment:
      -amountSuggestion * preferencesStore.get("insulinStepSize"),
    timingAdjustment: -timingSuggestion * preferencesStore.get("timeStepSize"),
  };
}

/**
 * This function gives you the correct insulin dose based on:
 * 1. History
 * 2. Nutrients offsets
 * 3. Current blood sugar
 * 4. Suggested changes from rule engine
 *
 * The history (previous shot[s]) comes from the template.
 * The nutrient offsets come from meal
 * The current blood sugar is passed in
 */
export function getInsulinDose(
  template: Template,
  meal: Meal,
  currentSugar: number
) {
  const base = template.insulin; // Previous dose for the _meal_ itself
  const mealOffset = template.getMealInsulinOffset(meal);
  const correction = getCorrectionInsulin(currentSugar);
  const adjustment = insulinDosingRecommendation(
    template.sessions
  ).amountAdjustment;
  return base + mealOffset + correction + adjustment;
}
