import { sessionsWeightedAverage } from "../lib/templateHelpers";
import { profile } from "../storage/metaProfileStore";
import type Meal from "./events/meal";
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
  /** This gives you the meal dose insulin taken last, not accounting for correction */
  get insulin(): number {
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
    carbs: number,
    protein: number
  } {
    // The alpha is basically a gradient descent from the general profile
    let alphaCarbs = profile.carbs.effect;
    let alphaProtein = profile.protein.effect;

    // Formula: alpha_new = alpha_old + mu * error/amount
    // In other words: alpha += mu * error / amount
    return {
      carbs: alphaCarbs,
      protein: alphaProtein
    }
  }
  getClosestSession(carbs: number, protein: number): Session | null {
    if (this.isFirstTime) return null;
    let session: Session = this.sessions[0];
    let lowestScore = Infinity;
    const carbsRise = carbs * this.alpha.carbs;
    const proteinRise = protein * this.alpha.protein;
    const totalRise = carbsRise + proteinRise;
    this.sessions.forEach((s: Session) => {
      if (s.isGarbage) return;
      // fractionDifference(new, old) = [new - old] / old
      const sessionCarbsRise = s.carbs * this.alpha.carbs;
      const sessionProteinRise = s.protein * this.alpha.protein;
      const sessionTotalRise = sessionCarbsRise + sessionProteinRise;

      const score = Math.abs(totalRise - sessionTotalRise);
      if (score < lowestScore) {
        session = s;
        lowestScore = score;
      }
    });
    return session;
  }

  // Dosing helpers
  getMealInsulinOffset(meal: Meal) {
    const additionalCarbs = meal.carbs - this.carbs;
    const additionalProtein = meal.protein - this.protein;
    const effect =
      additionalCarbs * profile.carbs.effect +
      additionalProtein * profile.protein.effect;
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
