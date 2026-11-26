import { getCircularHourDistance } from "../timing";
import { MathUtil } from "../util";
import { HealthMonitorStore } from "../../storage/healthMonitorStore";
import type Meal from "../../models/events/meal";
import type Session from "../../models/session";
import { getSimilarSessionsDistances } from "./getSimilarSessionsDistances";

/**
 * Base sessions: the past sessions a meal's dosing advice is drawn from,
 * chosen out of a pool of sessions. SessionManager passes a meal's own pool;
 * the forecast accuracy replay passes only the sessions that preceded the one
 * it replays.
 */

function getValidSessions(pool: Session[]) {
  return pool.filter((s) => !s.isInvalid);
}
/** The valid sessions that have not expired, or every valid one if all have */
function getFreshOrValidSessions(pool: Session[]) {
  const validSessions = getValidSessions(pool);
  const freshSessions = validSessions.filter((s) => !s.expired);
  return freshSessions.length > 0 ? freshSessions : validSessions;
}
function getMatchingSessions(meal: Meal, pool: Session[]): Session[] {
  if (meal.isEmpty) return [];
  return getValidSessions(pool).filter((s) => meal.matches(s.meal));
}

/** Every past session of this same meal, or the single most similar one if there are none */
export function getBaseSessionsFrom(
  meal: Meal,
  pool: Session[],
  timestamp = new Date(),
): Session[] {
  const matchingSessions = getMatchingSessions(meal, pool);
  if (matchingSessions.length > 0) return matchingSessions;
  const similarSession = getBaseSessionFrom(meal, pool, timestamp);
  return similarSession ? [similarSession] : [];
}
export function getBaseSessionFrom(
  meal: Meal,
  pool: Session[],
  timestamp = new Date(),
): Session | null {
  const atSimilarTime = (session: Session) =>
    getCircularHourDistance(session.timestamp, timestamp) <=
    HealthMonitorStore.maxHoursBetweenSessions.value;

  // The same meal beats anything merely similar, however old it is
  const matchingSessions = getMatchingSessions(meal, pool);
  if (matchingSessions.length > 0) {
    const sameTime = matchingSessions.filter(atSimilarTime);
    return (sameTime.length > 0 ? sameTime : matchingSessions).reduce(
      (latest, s) =>
        s.timestamp.getTime() > latest.timestamp.getTime() ? s : latest,
    );
  }

  const sessions = getFreshOrValidSessions(pool);
  if (sessions.length === 0) return null;
  const sessionsDistances = getSimilarSessionsDistances(meal, sessions);
  if (!sessionsDistances || sessionsDistances.length === 0) return null;

  let filteredSessionsDistances = sessionsDistances.filter(([s]) =>
    atSimilarTime(s),
  );
  if (filteredSessionsDistances.length === 0)
    filteredSessionsDistances = sessionsDistances;

  // Ensure ascending order by distance score
  const sortedDistances = filteredSessionsDistances
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
    .map((a) => a[0]);

  if (candidates.length === 0) return sortedDistances[0][0];

  // Pick the most recent session among the top candidates
  candidates.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return candidates[0];
}
