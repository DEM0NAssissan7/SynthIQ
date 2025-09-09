import { getOptimalMealInsulins } from "../lib/metabolism";
import { sessionsWeightedAverage } from "../lib/templateHelpers";
import { timeOfDayOffset } from "../lib/timing";
import { clamp, MathUtil } from "../lib/util";
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
      if (session && _session.isGarbage) continue;
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
        (s: Session) => s.getN(s.firstInsulinTimestamp),
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

    const baseLearningRate = 0.0003;

    const sessionHalfLife = PreferencesStore.sessionHalfLife.value;
    const maxSessionLife = PreferencesStore.maxSessionLife.value;

    // Don't allow less than 3 sessions before making any conclusions
    if (this.sessions.length >= 3) {
      for (let i = this.sessions.length - 1; i >= 0; i--) {
        const session = this.sessions[i];
        if (session.isGarbage) continue;
        const age = session.age;
        if (age > maxSessionLife) break; // If the session exceeds the max age
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
  getClosestSession(
    carbs: number,
    protein: number,
    timestamp: Date
  ): Session | null {
    if (this.isFirstTime) return null;

    let sessions = this.sessions.filter((s) => !s.isGarbage);
    if (sessions.length === 0) sessions = this.sessions; // If all we have is garbage, we still use it anyways (better than nothing)

    const getSafeScale = (absDistances: number[]) => {
      if (absDistances.length === 0) return 1e-6;
      const mean = MathUtil.mean(absDistances);
      if (mean > 0) return mean;
      const positives = absDistances.filter((x) => x > 0);
      return positives.length ? Math.min(...positives) : 1e-6;
    };

    // Query-centered per-axis scales = mean absolute differences (safe-guarded)
    const carbsScale = getSafeScale(
      sessions.map((s) => Math.abs(carbs - s.carbs))
    );
    const proteinScale = getSafeScale(
      sessions.map((s) => Math.abs(protein - s.protein))
    );
    const timeOfDayScale = getSafeScale(
      sessions.map((s) => Math.abs(timeOfDayOffset(timestamp, s.timestamp)))
    );
    const dateScale = (() => {
      const ages = sessions.map((s) => s.age); // days > 0
      const m = MathUtil.median(ages);
      if (m > 0) return Math.max(m, 1e-3); // small floor to avoid blowups
      // (shouldn’t happen given s.age>0, but safe)
      return Math.min(...ages) || 1e-3;
    })();

    let nearSessions: Session[] = [];
    for (let i = sessions.length - 1; i >= 0; i--) {
      const s: Session = sessions[i];

      if (
        Math.abs(carbs - s.carbs) <= carbsScale &&
        Math.abs(protein - s.protein) <= proteinScale &&
        timeOfDayOffset(timestamp, s.timestamp) <= timeOfDayScale
      ) {
        nearSessions.push(s);
      }
    }

    const K = Math.min(
      clamp(Math.floor(Math.sqrt(sessions.length)), 4, 9),
      sessions.length
    ); // Adaptive number of desired sessions
    if (nearSessions.length < K) {
      // Fallback to the closest 5 sessions if we can't find any nearby
      let sessionDistances: [Session, number][] = [];
      const keep = new Set(nearSessions.map((s) => s.uuid));
      for (let s of sessions) {
        if (keep.has(s.uuid)) continue; // Deduplication
        sessionDistances.push([
          s,
          ((carbs - s.carbs) / carbsScale) ** 2 +
            ((protein - s.protein) / proteinScale) ** 2 +
            (timeOfDayOffset(timestamp, s.timestamp) / timeOfDayScale) ** 2 + // Squared ecludian distance
            (1 / Math.sqrt(PreferencesStore.maxSessionLife.value)) *
              (s.age / dateScale) ** 2,
        ]);
      }
      sessionDistances.sort((a, b) => a[1] - b[1]);
      nearSessions.push(
        ...sessionDistances.slice(0, K - nearSessions.length).map((a) => a[0])
      );
    }
    if (nearSessions.length === 0) return null;
    console.log(nearSessions);

    const medianOptimalInsulin = MathUtil.median(
      nearSessions.map((s) => s.optimalMealInsulin)
    );
    let closestSession: Session = nearSessions[0];
    nearSessions.forEach((s) => {
      const differenceToMedian = Math.abs(
        s.optimalMealInsulin - medianOptimalInsulin
      );
      const closestDistanceToMedian = Math.abs(
        closestSession.optimalMealInsulin - medianOptimalInsulin
      );
      if (
        differenceToMedian < closestDistanceToMedian ||
        (differenceToMedian === closestDistanceToMedian &&
          s.age < closestSession.age) // Prefer younger sessions
      ) {
        closestSession = s;
      }
    });
    return closestSession;
  }

  // Dosing helpers
  vectorizeInsulin(
    carbs: number,
    protein: number,
    timeOfDay: Date
  ): Insulin[] | null {
    const session = this.getClosestSession(carbs, protein, timeOfDay);
    if (!session) return null;

    // Fill in the gaps
    const carbsInsulinOffset = this.getMealInsulinOffset(
      session.carbs,
      0,
      carbs,
      0
    );
    const proteinInsulinOffset = this.getMealInsulinOffset(
      0,
      session.protein,
      0,
      protein
    );

    // Legacy
    // return [
    //   new Insulin(
    //     session.optimalMealInsulin + carbsInsulinOffset + proteinInsulinOffset,
    //     session.firstInsulinTimestamp
    //   ),
    // ];
    const insulins = getOptimalMealInsulins(session);
    insulins[0].value += carbsInsulinOffset; // Add extra carbs offset to first shot, as they typically only act on first shot timeframe

    const proteinInsulinPerShot = proteinInsulinOffset / insulins.length;
    insulins.forEach((i) => (i.value += proteinInsulinPerShot)); // Distribute protein offset between all shots
    return insulins;
  }
  getMealInsulinOffset(
    baseCarbs: number,
    baseProtein: number,
    carbs: number,
    protein: number
  ) {
    const alpha = this.alpha;
    const additionalCarbs = carbs - baseCarbs;
    const additionalProtein = protein - baseProtein;
    const effect =
      additionalCarbs * alpha.carbs + additionalProtein * alpha.protein;
    const neededInsulin = effect / CalibrationStore.insulinEffect.value;
    return neededInsulin;
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
