import { sessionsWeightedAverage } from "../lib/templateHelpers";
import { CalibrationStore } from "../storage/calibrationStore";
import { PreferencesStore } from "../storage/preferencesStore";
import Session from "./session";
import Subscribable from "./subscribable";
import type { Deserializer, Serializer } from "./types/types";

export default class Template extends Subscribable {
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
  getClosestSession(carbs: number, protein: number): Session | null {
    if (this.isFirstTime) return null;
    let session: Session | null = null;
    let lowestScore = Infinity;
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      const s: Session = this.sessions[i];
      if (s.isGarbage) continue;

      const score = (carbs - s.carbs) ** 2 + (protein - s.protein) ** 2; // Squared ecludian distance
      if (score < lowestScore) {
        session = s;
        lowestScore = score;
      }
    }
    return session;
  }

  // Dosing helpers
  vectorizeInsulin(carbs: number, protein: number) {
    const session = this.getClosestSession(carbs, protein);
    if (!session) return null;
    const optimalMealInsulin = session.optimalMealInsulin;
    const neededInsulin =
      optimalMealInsulin +
      this.getMealInsulinOffset(session.carbs, session.protein, carbs, protein);
    return neededInsulin;
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
  static serialize: Serializer<Template> = (template: Template) => {
    return JSON.stringify({
      name: template.name,
      sessions: template.sessions.map((s) => Session.serialize(s)),
      timestamp: template.timestamp,
    });
  };
  static deserialize: Deserializer<Template> = (s: string) => {
    const o = JSON.parse(s);
    let template = new Template(o.name);
    o.sessions.forEach((s: string) =>
      template.addSession(Session.deserialize(s))
    );
    template.timestamp = new Date(o.timestamp);
    return template;
  };
}
