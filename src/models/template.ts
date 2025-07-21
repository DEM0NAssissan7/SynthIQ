import { getCorrectionInsulin } from "../lib/metabolism";
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
      session = this.sessions[i];
      if (session.isGarbage) continue;
    }
    if (!session)
      throw new Error(`Cannot retrieve latest session: unknown error`);
    return session;
  }

  // Nutrition Information
  get carbs(): number {
    return this.latestSession.carbs;
  }
  get protein(): number {
    return this.latestSession.protein;
  }
  get fat(): number {
    return this.latestSession.fat;
  }

  // Dosing info
  /** This gives you the meal dose insulin taken last, not accounting for correction */
  get insulin(): number {
    return (
      this.latestSession.insulin -
      getCorrectionInsulin(this.latestSession.initialGlucose)
    );
  }
  get insulinTiming(): number {
    return (
      sessionsWeightedAverage(
        (s: Session) => s.getN(s.firstInsulinTimestamp),
        this.sessions
      ) * 60
    );
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
