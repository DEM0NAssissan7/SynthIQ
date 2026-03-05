import { getBasalSensitivity } from "../lib/basal";
import { sessionsWeightedAverage } from "../lib/templateHelpers";
import { timeOfDayOffset } from "../lib/timing";
import { clamp, MathUtil } from "../lib/util";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { BasalStore } from "../storage/basalStore";
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
  get bestSession(): Session {
    if (this.sessions.length === 0)
      throw new Error(`There are no sessions in this template!`);
    const sessions = this.freshOrValidSessions;
    let session: Session | null = null;
    sessions.forEach((s) => {
      if (!session) {
        session = s;
        return;
      }
      if (s.score < session.score) {
        session = s;
      }
    });
    if (!session)
      throw new Error(`Cannot retrieve best session: unknown error`);
    return session;
  }
  get typicalSession(): Session {
    if (this.sessions.length === 0)
      throw new Error(`There are no sessions in this template!`);
    const validSessions = this.validSessions;
    let typicalCarbs = MathUtil.mode(validSessions.map((s) => s.carbs));
    let typicalProtein = MathUtil.mode(validSessions.map((s) => s.protein));
    let typicalNumFoods = MathUtil.mode(
      validSessions.map((s) => s.firstMeal.foods.length),
    );

    let typicalSessions: Session[] = [];
    let minDeviation = Infinity;
    this.freshOrValidSessions.forEach((s) => {
      // Ecludian distance
      const deviation =
        (s.carbs - typicalCarbs) ** 2 +
        (s.protein - typicalProtein) ** 2 +
        (typicalNumFoods - s.firstMeal.foods.length) ** 2;
      if (deviation < minDeviation) {
        typicalSessions = [];
        minDeviation = deviation;
      }
      if (deviation === minDeviation) {
        typicalSessions.push(s);
      }
    });
    if (typicalSessions.length === 0) throw new Error(`Unknown error.`);
    // Among the most typical, yeild the most well-controlled
    typicalSessions.sort((a, b) => a.score - b.score);
    return typicalSessions[0];
  }
  get recommendedSession(): Session {
    if (this.sessions.length === 0)
      throw new Error(`There are no sessions in this template!`);
    const sessions = this.validSessions.filter((s) => s.age < 5); // All sessions within the last 5 days
    if (!sessions.length) return this.typicalSession;
    let bestSession: Session | null = null;
    let minScore = Infinity;
    sessions.forEach((s) => {
      const score = s.score; // Cache score in a variable to prevent running the getter again
      if (score < minScore) {
        minScore = score;
        bestSession = s;
      }
    });
    if (!bestSession) throw new Error(`Unknown error.`);
    return bestSession;
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
    return MathUtil.median(this.validSessions.map((s) => s.score));
  }
  get size(): number {
    return this.sessions.length;
  }
  get validSessions(): Session[] {
    const sessions = this.sessions.filter((s) => !s.isInvalid);
    return sessions;
  }
  get freshSessions(): Session[] {
    const sessions = this.validSessions.filter((s) => !s.expired);
    return sessions;
  }
  get expiredSessions(): Session[] {
    const sessions = this.validSessions.filter((s) => s.expired);
    return sessions;
  }
  get freshOrValidSessions(): Session[] {
    const freshSessions = this.freshSessions;
    if (freshSessions.length === 0) return this.validSessions;
    return freshSessions;
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
        this.sessions,
      ) * 60
    );
  }

  // Meal Vectorization
  vectorizer(
    timestamp: Date,
    fastingVelocity: number,
    dailyBasal: number,
  ): Session[] | null {
    if (this.isFirstTime) return null;
    const validSessions = this.validSessions;
    if (validSessions.length === 0) return null; // Do not vectorize if we don't have any valid sessions

    let sessions = this.freshSessions;

    // K is the number of neighbors to select
    const K = Math.min(
      clamp(Math.floor(this.sessions.length / 3), 3, 9),
      this.sessions.length,
    ); // Adaptive number of desired sessions based on number of valid sessions

    // Discard expired sessions unless we don't have enough to fulfill K
    const expiredSessions = this.expiredSessions
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
    const timeOfDayScale = getSafeScale(
      sessions.map((s) => Math.abs(timeOfDayOffset(timestamp, s.timestamp))),
    );
    const estimatedLiverOutput = BasalStore.estimatedLiverOutput.value ?? 0;
    const sensitivityIndex = getBasalSensitivity(
      estimatedLiverOutput,
      fastingVelocity,
      dailyBasal,
    ); // mg/dL per unit
    const sensitivityIndexScale = getSafeScale(
      sessions.map((s) =>
        Math.abs(
          sensitivityIndex - (s.getSensitivityIndex(estimatedLiverOutput) ?? 0),
        ),
      ),
    );

    // Get the closest X sessions
    let sessionDistances: [Session, number][] = [];
    for (let s of sessions) {
      if (!s.initialGlucose) continue;
      sessionDistances.push([
        s,
        (timeOfDayOffset(timestamp, s.timestamp) / timeOfDayScale) ** 2 + // Squared ecludian distance
          ((sensitivityIndex -
            (s.getSensitivityIndex(estimatedLiverOutput) ?? 0)) /
            sensitivityIndexScale) **
            2,
      ]);
    }
    sessionDistances.sort((a, b) => a[1] - b[1]);

    const nearSessions: Session[] = sessionDistances
      .slice(0, K)
      .map((a) => a[0]);
    if (nearSessions.length === 0) return null;

    // Eliminate outliers
    const kept: Session[] = [];
    const medianMealInsulin = MathUtil.median(
      nearSessions.map((s) => s.mealInsulin),
    );
    const mealInsulinMAD = getSafeScale(
      nearSessions.map((s) => Math.abs(s.mealInsulin - medianMealInsulin)),
    );

    const TAU = 1.5; // or 2.0 if you want looser
    const cutoff = TAU * mealInsulinMAD;
    for (let i = 0; i < nearSessions.length; i++) {
      const s = nearSessions[i];
      // Get rid of outliers
      if (Math.abs(s.mealInsulin - medianMealInsulin) <= cutoff) {
        kept.push(s);
        continue;
      }
    }

    let result = kept;
    if (result.length === 0) result = nearSessions;
    return result.sort((a, b) => a.age - b.age);
  }
  getClosestSession(
    timestamp: Date,
    fastingVelocity: number,
    dailyBasal: number,
  ): Session | null {
    const closestSessions = this.vectorizer(
      timestamp,
      fastingVelocity,
      dailyBasal,
    );
    if (!closestSessions) return null;
    return closestSessions[0];
  }
  getOptimalSession(
    timestamp: Date,
    fastingVelocity: number,
    dailyBasal: number,
  ): Session | null {
    const closestSessions = this.vectorizer(
      timestamp,
      fastingVelocity,
      dailyBasal,
    );
    if (!closestSessions) return null;
    // Choose the most typically controlled session (to avoid outliars)
    const medianScore = MathUtil.median(closestSessions.map((a) => a.score));
    return closestSessions.sort((a, b) => {
      const MADA = Math.abs(a.score - medianScore);
      const MADB = Math.abs(b.score - medianScore);
      return MADA - MADB;
    })[0];
  }

  // Dosing helpers
  vectorizeInsulin(
    carbs: number,
    protein: number,
    session: Session | null,
  ): Insulin[] {
    if (!session) {
      const defaultVariant = InsulinVariantManager.getDefault();
      const profileInsulin = this.getProfileInsulin(
        carbs,
        protein,
        defaultVariant,
      );
      return [new Insulin(profileInsulin, new Date(), defaultVariant)];
    }
    let insulins = session.optimalMealInsulins.map(
      (i) => new Insulin(i.value, i.timestamp, i.variant),
    );
    const offsets = this.getInsulinOffsets(session, carbs, protein);
    for (let i = 0; i < insulins.length; i++) {
      insulins[i].value += offsets[i].value;
    }
    return insulins;
  }
  getProfileInsulin(
    carbs: number,
    protein: number,
    variant = InsulinVariantManager.getDefault(),
  ) {
    const carbsRise = carbs * CalibrationStore.carbsEffect.value;
    const proteinRise = protein * CalibrationStore.proteinEffect.value;
    return (carbsRise + proteinRise) / variant.effect;
  }
  getInsulinOffsets(session: Session, carbs: number, protein: number) {
    const insulins = session.optimalMealInsulins.map(
      (i) => new Insulin(0, i.timestamp, i.variant),
    );
    const extraCarbsRise =
      (carbs - session.carbs) * CalibrationStore.carbsEffect.value;
    insulins[0].value += extraCarbsRise / insulins[0].variant.effect; // Add extra carbs offset to first shot, as they typically only act on first shot timeframe

    const extraProteinRisePerShot =
      ((protein - session.protein) / insulins.length) *
      CalibrationStore.proteinEffect.value;
    insulins.forEach(
      (i) => (i.value += extraProteinRisePerShot / i.variant.effect),
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
      (s) => s.age < PreferencesStore.maxSessionLife.value,
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
      template.addSession(Session.deserialize(s)),
    );
    template.timestamp = new Date(o.timestamp);
    return template;
  };
}
