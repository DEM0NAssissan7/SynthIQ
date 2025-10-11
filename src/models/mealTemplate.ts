import { sessionsWeightedAverage } from "../lib/templateHelpers";
import { timeOfDayOffset } from "../lib/timing";
import { clamp, MathUtil } from "../lib/util";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { CalibrationStore } from "../storage/calibrationStore";
import { PreferencesStore } from "../storage/preferencesStore";
import Insulin from "./events/insulin";
import Session from "./session";
import Subscribable from "./subscribable";
import type { Template } from "./types/interfaces";
import type { Deserializer, Serializer } from "./types/types";

export default class MealTemplate extends Subscribable implements Template {
  sessions: Session[] = [];
  timestamp: Date;

  constructor(public name: string) {
    super();
    this.timestamp = new Date();
  }

  // Session management
  addSession(session: Session) {
    this.sessions.push(session);
    this.timestamp = session.timestamp; // We set the timestamp to be the latest added session timestamp
    this.addChildSubscribable(session);
  }
  get isFirstTime(): boolean {
    return this.sessions.length === 0;
  }
  get latestSession(): Session {
    if (this.sessions.length === 0)
      throw new Error(`There are no sessions in this template!`);
    let session: Session | null = null;
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      const _session = this.sessions[i];
      if (session && _session.isInvalid) continue;
      session = _session;
      break;
    }
    if (!session)
      throw new Error(`Cannot retrieve latest session: unknown error`);
    return session;
  }

  // Nutrition Information
  get carbs(): number {
    if (this.isFirstTime) return 0;
    return this.latestSession.carbs;
  }
  get protein(): number {
    if (this.isFirstTime) return 0;
    return this.latestSession.protein;
  }
  get fat(): number {
    if (this.isFirstTime) return 0;
    return this.latestSession.fat;
  }

  // Control info
  get score(): number {
    return MathUtil.median(this.sessions.map((s) => s.score));
  }
  get size(): number {
    return this.sessions.length;
  }

  // Dosing info
  /** This gies you the meal dose insulin taken last, not accounting for correction */
  get previousInsulin(): number {
    if (this.isFirstTime) return 0;
    return this.latestSession.mealInsulin;
  }
  get insulinTiming(): number {
    if (this.isFirstTime) return 0;
    return (
      sessionsWeightedAverage(
        (s: Session) => s.getRelativeN(s.firstInsulinTimestamp),
        this.sessions
      ) * 60
    );
  }

  // Meal Vectorization
  get alpha(): {
    carbs: number;
    protein: number;
  } {
    // The alpha is basically a gradient descent from the general profile
    let alphaCarbs = CalibrationStore.carbsEffect.value;
    let alphaProtein = CalibrationStore.proteinEffect.value;

    const baseLearningRate = 0.001;

    const sessionHalfLife = PreferencesStore.sessionHalfLife.value;

    // Don't allow less than 3 sessions before making any conclusions
    if (this.sessions.length >= 3) {
      for (let i = this.sessions.length - 1; i >= 0; i--) {
        const session = this.sessions[i];
        if (session.isInvalid) continue;
        const age = session.age;
        const weight = Math.pow(0.5, age / sessionHalfLife);
        const eta = baseLearningRate * weight;

        const predictedMealRise =
          alphaCarbs * session.carbs + alphaProtein * session.protein;
        const actualMealRise = session.mealRise;
        const error = predictedMealRise - actualMealRise;

        alphaCarbs -= eta * error * session.carbs;
        alphaProtein -= eta * error * session.protein;
      }
    }

    return {
      carbs: alphaCarbs,
      protein: alphaProtein,
    };
  }
  getClosestSessions(
    carbs: number,
    protein: number,
    timestamp: Date,
    initialBG: number
  ): Session[] | null {
    if (this.isFirstTime) return null;

    let sessions = this.sessions.filter((s) => !s.isInvalid);
    if (sessions.length === 0) sessions = this.sessions; // If all we have is garbage, we still use it anyways (better than nothing)

    // K is the number of neighbors to select
    const K = Math.min(
      clamp(Math.floor(Math.sqrt(this.sessions.length)), 3, 9),
      this.sessions.length
    ); // Adaptive number of desired sessions based on number of valid sessions

    // Discard expired sessions unless we don't have enough to fulfill K
    const expiredSessions = sessions
      .filter((s) => s.expired)
      .slice()
      .sort((a, b) => a.age - b.age); // Sort by age to pull the newest ones first
    sessions = sessions.filter((s) => !s.expired); // Filter out expired sessions
    if (sessions.length < K) {
      // Salvage the latest expired sessions
      sessions.push(...expiredSessions.slice(0, K - sessions.length));
    }

    const getSafeScale = (absDistances: number[]) => {
      if (absDistances.length === 0) return 1e-6;
      const median = MathUtil.median(absDistances);
      if (median > 0) return median;
      const mean = MathUtil.mean(absDistances);
      if (mean > 0) return mean;
      const positives = absDistances.filter((x) => x > 0);
      return positives.length ? Math.min(...positives) : 1e-3;
    };

    // Query-centered per-axis scales = median/mean absolute differences (safe-guarded)
    const carbsScale = getSafeScale(
      sessions.map((s) => Math.abs(carbs - s.carbs))
    );
    const proteinScale = getSafeScale(
      sessions.map((s) => Math.abs(protein - s.protein))
    );
    const initialBGScale = getSafeScale(
      sessions.map((s) => {
        return Math.abs(
          s.initialGlucose !== null ? initialBG - s.initialGlucose : 0
        );
      })
    );
    const timeOfDayScale = getSafeScale(
      sessions.map((s) => Math.abs(timeOfDayOffset(timestamp, s.timestamp)))
    );

    // Get the closest X sessions
    let sessionDistances: [Session, number][] = [];
    for (let s of sessions) {
      if (!s.initialGlucose) continue;
      sessionDistances.push([
        s,
        ((carbs - s.carbs) / carbsScale) ** 2 +
          ((protein - s.protein) / proteinScale) ** 2 +
          (timeOfDayOffset(timestamp, s.timestamp) / timeOfDayScale) ** 2 + // Squared ecludian distance
          ((initialBG - s.initialGlucose) / initialBGScale) ** 2,
      ]);
    }
    sessionDistances.sort((a, b) => a[1] - b[1]);

    const nearSessions: Session[] = sessionDistances
      .slice(0, K)
      .map((a) => a[0]);
    if (nearSessions.length === 0) return null;
    console.log(nearSessions);

    // Eliminate outliers
    const kept: Session[] = [];
    const medianOptimalInsulin = MathUtil.median(
      nearSessions.map((s) => s.optimalMealInsulin)
    );
    const optimalInsulinMAD = getSafeScale(
      nearSessions.map((s) =>
        Math.abs(s.optimalMealInsulin - medianOptimalInsulin)
      )
    );
    console.log(medianOptimalInsulin, optimalInsulinMAD);

    const TAU = 1.5; // or 2.0 if you want looser
    const cutoff = TAU * optimalInsulinMAD;
    for (let i = 0; i < nearSessions.length; i++) {
      const s = nearSessions[i];
      // Get rid of outliers
      if (Math.abs(s.optimalMealInsulin - medianOptimalInsulin) <= cutoff) {
        kept.push(s);
        continue;
      }
    }

    let result = kept;
    if (result.length === 0) result = nearSessions;
    return result.sort((a, b) => a.age - b.age);
  }
  getClosestSession(
    carbs: number,
    protein: number,
    timestamp: Date,
    initialBG: number
  ): Session | null {
    const closestSessions = this.getClosestSessions(
      carbs,
      protein,
      timestamp,
      initialBG
    );
    if (!closestSessions) return null;
    return closestSessions[0];
  }
  getOptimalSession(
    carbs: number,
    protein: number,
    timestamp: Date,
    initialBG: number
  ): Session | null {
    const closestSessions = this.getClosestSessions(
      carbs,
      protein,
      timestamp,
      initialBG
    );
    if (!closestSessions) return null;
    return closestSessions.sort((a, b) => a.score - b.score)[0];
  }

  // Dosing helpers
  vectorizeInsulin(
    carbs: number,
    protein: number,
    timeOfDay: Date,
    initialBG: number
  ): Insulin[] | null {
    const session = this.getOptimalSession(
      carbs,
      protein,
      timeOfDay,
      initialBG
    );
    if (!session) return null;
    if (session.insulins.length === 0) return null;

    const insulins = session.optimalMealInsulins;
    const offsets = this.getInsulinOffsets(session, carbs, protein);
    for (let i = 0; i < insulins.length; i++) {
      insulins[i].value += offsets[i].value;
    }
    return insulins;
  }
  getProfileInsulin(
    carbs: number,
    protein: number,
    variant = InsulinVariantManager.getDefault()
  ) {
    const alpha = this.alpha;
    const carbsRise = carbs * alpha.carbs;
    const proteinRise = protein * alpha.protein;
    return (carbsRise + proteinRise) / variant.effect;
  }
  getInsulinOffsets(session: Session, carbs: number, protein: number) {
    const insulins = session.optimalMealInsulins;
    const alpha = this.alpha;
    const extraCarbsRise = (carbs - session.carbs) * alpha.carbs;
    insulins[0].value = extraCarbsRise / insulins[0].variant.effect; // Add extra carbs offset to first shot, as they typically only act on first shot timeframe

    const extraProteinRisePerShot =
      ((protein - session.protein) / insulins.length) * alpha.protein;
    insulins.forEach(
      (i) => (i.value = extraProteinRisePerShot / i.variant.effect)
    ); // Distribute protein between all shots
    return insulins;
  }
  getMealInsulinOffset(session: Session, carbs: number, protein: number) {
    let insulin = 0;
    const offsets = this.getInsulinOffsets(session, carbs, protein);
    offsets.forEach((offset) => (insulin += offset.value));
    return insulin;
  }

  // Serialization
  static serialize: Serializer<MealTemplate> = (template: MealTemplate) => {
    const sessions = template.sessions.filter(
      (s) => s.age < PreferencesStore.maxSessionLife.value
    ); // Get rid of old sessions upon serialization
    return {
      name: template.name,
      sessions: sessions.map((s) => Session.serialize(s)),
      timestamp: template.timestamp.getTime(),
    };
  };
  static deserialize: Deserializer<MealTemplate> = (o) => {
    let template = new MealTemplate(o.name);
    o.sessions.forEach((s: string) =>
      template.addSession(Session.deserialize(s))
    );
    template.timestamp = new Date(o.timestamp);
    return template;
  };
}
