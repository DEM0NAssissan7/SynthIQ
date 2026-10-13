import {
  getSimilarSessionsDistances,
  type SessionAndScore,
} from "../lib/helpers/getSimilarSessionsDistances";
import { sessionsWeightedAverage } from "../lib/templateHelpers";
import { getCircularHourDistance } from "../lib/timing";
import { genUUID, MathUtil } from "../lib/util";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PreferencesStore } from "../storage/preferencesStore";
import Meal from "./events/meal";
import Session from "./session";
import Subscribable from "./subscribable";
import type { Template } from "./types/interfaces";
import type { Deserializer, Serializer, UUID } from "./types/types";

export default class MealTemplate extends Subscribable implements Template {
  _sessions: Session[] = [];
  auxillarySessions: Session[] = []; // Sessions that will not be serialized
  timestamp: Date;
  UUID: UUID;

  constructor(public name: string) {
    super();
    this.timestamp = new Date();
    this.UUID = genUUID();
  }
  get sessions() {
    return [...this._sessions, ...this.auxillarySessions];
  }

  // Session management
  addSession(session: Session) {
    this._sessions.push(session);
    this.timestamp = session.timestamp; // We set the timestamp to be the latest added session timestamp
    this.addChildSubscribable(session);
    this.notify();
  }
  get isFirstTime(): boolean {
    return this.sessions.length === 0;
  }
  get latestSession(): Session | null {
    if (this.sessions.length === 0) return null;
    let session: Session | null = null;
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      const _session = this.sessions[i];
      if (_session && _session.isInvalid) continue;
      session = _session;
      break;
    }
    return session;
  }
  get bestSession(): Session | null {
    if (this.sessions.length === 0) return null;
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
    return session;
  }
  get typicalSession(): Session | null {
    if (this.sessions.length === 0) return null;
    const validSessions = this.validSessions;
    if (validSessions.length === 0) return null;
    let typicalCarbs = MathUtil.mode(validSessions.map((s) => s.carbs));
    let typicalProtein = MathUtil.mode(validSessions.map((s) => s.protein));
    let typicalNumFoods = MathUtil.mode(
      validSessions.map((s) => s.meal?.foods.length ?? 0),
    );

    let typicalSessions: Session[] = [];
    let minDeviation = Infinity;
    this.freshOrValidSessions.forEach((s) => {
      // Euclidean distance
      const deviation =
        (s.carbs - typicalCarbs) ** 2 +
        (s.protein - typicalProtein) ** 2 +
        (typicalNumFoods - (s.meal?.foods.length ?? 0)) ** 2;
      if (deviation < minDeviation) {
        typicalSessions = [];
        minDeviation = deviation;
      }
      if (deviation === minDeviation) {
        typicalSessions.push(s);
      }
    });
    if (typicalSessions.length === 0) return null;
    // Among the most typical, yield the most well-controlled
    typicalSessions.sort((a, b) => a.score - b.score);
    return typicalSessions[0];
  }
  get recommendedSession(): Session | null {
    if (this.sessions.length === 0) return null;
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
    return bestSession;
  }

  // Nutrition Information
  get carbs(): number {
    if (this.isFirstTime) return 0;
    const session = this.latestSession;
    return session ? session.carbs : 0;
  }
  get protein(): number {
    if (this.isFirstTime) return 0;
    const session = this.latestSession;
    return session ? session.protein : 0;
  }
  get fat(): number {
    if (this.isFirstTime) return 0;
    const session = this.latestSession;
    return session ? session.fat : 0;
  }

  // Control info
  get score(): number {
    return MathUtil.median(this.validSessions.map((s) => s.score));
  }
  get size(): number {
    return this.sessions.length;
  }
  get validSessions(): Session[] {
    return this.sessions.filter((s) => !s.isInvalid);
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
    const session = this.latestSession;
    return session ? session.mealInsulin : 0;
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

  getSimilarSessionsDistances(meal: Meal): SessionAndScore[] | null {
    if (this.isFirstTime) return null;

    const sessions = this.freshOrValidSessions;
    if (sessions.length === 0) return null;
    return getSimilarSessionsDistances(meal, sessions);
  }
  getBaseSession(meal: Meal, timestamp = new Date()): Session | null {
    const sessionsDistances = this.getSimilarSessionsDistances(meal);
    if (!sessionsDistances || sessionsDistances.length === 0) return null;

    // Ensure ascending order by distance score
    const sortedDistances = sessionsDistances
      .slice()
      .sort((a, b) => a[1] - b[1]);

    const bestDistance = sortedDistances[0][1];
    const distances = sortedDistances.map((a) => a[1]);

    // Calculate MAD with a safe fallback floor to prevent 0-dispersion collapse
    const mad = MathUtil.medianAbsoluteDeviation(distances);

    // Safe spread factor (at least 1e-3)
    const spreadAllowance = Math.max(mad, 1e-3);
    const maxAcceptableDistance = bestDistance * 2 + spreadAllowance;

    // Gather all sessions falling within the acceptable neighborhood of the best match
    const candidates: Session[] = sortedDistances
      .filter(([_, dist]) => dist <= maxAcceptableDistance)
      .map((a) => a[0])
      .filter(
        (session) =>
          getCircularHourDistance(session.timestamp, timestamp) <=
          HealthMonitorStore.maxHoursBetweenSessions.value,
      );

    if (candidates.length === 0) return sortedDistances[0][0];

    // Pick the most recent session among the top candidates
    candidates.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return candidates[0];
  }

  // Serialization
  static serialize: Serializer<MealTemplate> = (template: MealTemplate) => {
    const sessions = template._sessions.filter(
      (s) => s.age < PreferencesStore.maxSessionLife.value,
    ); // Get rid of old sessions upon serialization
    return {
      name: template.name,
      sessions: sessions.map((s) => Session.serialize(s)),
      timestamp: template.timestamp.getTime(),
      UUID: template.UUID,
    };
  };
  static deserialize: Deserializer<MealTemplate> = (o) => {
    const template = new MealTemplate(o.name);
    o.sessions.forEach((s: string) =>
      template.addSession(Session.deserialize(s)),
    );
    template.timestamp = new Date(o.timestamp);
    template.UUID = o.UUID ?? template.UUID;
    return template;
  };
}
