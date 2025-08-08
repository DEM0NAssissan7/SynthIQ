import { sessionsWeightedAverage } from "../lib/templateHelpers";
import { profile } from "../storage/metaProfileStore";
import preferencesStore from "../storage/preferencesStore";
import MetabolismProfile from "./metabolism/metabolismProfile";
import Session from "./session";

export default class Template {
  sessions: Session[] = [];
  profile: MetabolismProfile;
  timestamp: Date;

  constructor(public name: string) {
    this.profile = MetabolismProfile.parse(
      MetabolismProfile.stringify(profile)
    ); // Hard copy profile into own profile to give baseline profile
    this.timestamp = new Date();
  }

  // Session management
  addSession(session: Session) {
    this.sessions.push(session);
    this.timestamp = session.timestamp; // We set the timestamp to be the latest added session timestamp
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
    let alphaCarbs = profile.carbs.effect;
    let alphaProtein = profile.protein.effect;

    const baseLearningRate = 0.0003;

    const sessionHalfLife = preferencesStore.get("sessionHalfLife");
    const maxSessionLife = preferencesStore.get("maxSessionLife");

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

        console.log(
          "Carbs Change:",
          eta * error * session.carbs,
          "Protein Change",
          eta * error * session.protein
        );
        alphaCarbs -= eta * error * session.carbs;
        alphaProtein -= eta * error * session.protein;
      }
    }

    //DEBUG
    console.log(
      "Profile Carbs:",
      profile.carbs.effect,
      "Profile Protein:",
      profile.protein.effect
    );
    console.log("Alpha Carbs:", alphaCarbs, "Alpha Protein:", alphaProtein);
    for (let session of this.sessions) {
      if (session.isGarbage) continue;
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
    const alpha = this.alpha;
    const carbsRise = carbs * alpha.carbs;
    const proteinRise = protein * alpha.protein;
    const totalRise = carbsRise + proteinRise;
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      const s: Session = this.sessions[i];
      if (s.isGarbage) continue;
      // fractionDifference(new, old) = [new - old] / old
      const sessionCarbsRise = s.carbs * alpha.carbs;
      const sessionProteinRise = s.protein * alpha.protein;
      const sessionTotalRise = sessionCarbsRise + sessionProteinRise;

      const score = Math.abs(totalRise - sessionTotalRise);
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
    const neededInsulin = effect / profile.insulin.effect;
    return neededInsulin;
  }

  // Serialization
  static stringify(template: Template): string {
    return JSON.stringify({
      name: template.name,
      sessions: template.sessions.map((s) => Session.stringify(s)),
      profile: MetabolismProfile.stringify(template.profile),
      timestamp: template.timestamp,
    });
  }
  static parse(s: string): Template {
    const o = JSON.parse(s);
    let template = new Template(o.name);
    template.sessions = o.sessions.map((s: string) => Session.parse(s));
    template.profile = MetabolismProfile.parse(o.profile);
    template.timestamp = new Date(o.timestamp);
    return template;
  }
}
