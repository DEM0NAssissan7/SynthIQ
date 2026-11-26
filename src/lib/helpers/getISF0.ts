import type SugarReading from "../../models/types/sugarReading";
import type Glucose from "../../models/events/glucose";
import type Insulin from "../../models/events/insulin";
import type Meal from "../../models/events/meal";
import { estimateDynamicMetabolicActivity } from "./estimateDynamicISF";
import type Session from "../../models/session";
import Snapshot from "../../models/snapshot";
import WizardManager from "../../managers/wizardManager";

function sortTimes(a: { timestamp: Date }, b: { timestamp: Date }) {
  return a.timestamp.getTime() - b.timestamp.getTime();
}
function extractInfo(
  sessions: Session[],
): [Glucose[], Insulin[], Meal[], SugarReading[]] {
  const rescues: Glucose[] = [];
  const insulins: Insulin[] = [];
  const meals: Meal[] = [];
  const masterSnapshot: Snapshot = new Snapshot();
  for (const session of sessions) {
    if (session.isInvalid) continue;
    rescues.push(...session.glucoses);
    insulins.push(...session.insulins);
    if (session.meal) meals.push(session.meal);
    masterSnapshot.absorb(session.snapshot);
  }
  return [
    rescues.sort(sortTimes),
    insulins.sort(sortTimes),
    meals.sort(sortTimes),
    masterSnapshot.readings.sort(sortTimes),
  ];
}
function getPassiveMetabolicActivity(
  readings: SugarReading[],
  rescues: Glucose[],
  insulins: Insulin[],
  meals: Meal[],
) {
  return estimateDynamicMetabolicActivity(
    readings,
    insulins,
    rescues,
    false,
    null,
    meals,
  );
}
function getAllSessionsInfo() {
  const sessions = WizardManager.getAllSessions();
  return extractInfo(sessions);
}
export function getPassiveInfo() {
  const [rescues, insulins, meals, readings] = getAllSessionsInfo();
  return getPassiveMetabolicActivity(readings, rescues, insulins, meals);
}
