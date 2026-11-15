import type Insulin from "../../models/events/insulin";
import type Glucose from "../../models/events/glucose";
import type Session from "../../models/session";
import type Activity from "../../models/events/activity";
import { formatClock, formatDose, formatRelative } from "./glucoseFormat";
import { round } from "../../lib/util";

export type HubEventKind = "bolus" | "meal" | "rescue" | "basal" | "activity";

export interface HubEvent {
  id: string;
  kind: HubEventKind;
  time: number;
  /** End of a span event (activities). */
  end?: number;
  /** Short label shown on the timeline marker. */
  label: string;
  /** Sheet title. */
  title: string;
  details: { label: string; value: string }[];
  /** Summable size (units for insulin, grams for meals/rescues). */
  amount?: number;
  /** For meals: the session it belongs to and its template name. */
  session?: Session;
  mealName?: string;
}

export interface MealSession {
  session: Session;
  name: string;
}

/** Grams with one decimal below 10 so small amounts don't read as 0g. */
export function formatGrams(g: number): string {
  const r = Math.abs(g) < 10 ? round(g, 1) : Math.round(g);
  return `${r}g`;
}

/** Label for a marker standing for one or more same-kind events. */
export function markerLabel(events: HubEvent[]): string {
  if (events.length === 1) return events[0].label;
  const kind = events[0].kind;
  // Meals are labelled by name: the first, plus how many more.
  if (kind === "meal") return `${events[0].label} +${events.length - 1}`;
  if (events.some((e) => e.amount === undefined)) return events[0].label;
  const total = events.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  return kind === "bolus" || kind === "basal"
    ? `${formatDose(total)}u`
    : formatGrams(total);
}

export const eventKindPlural: Record<HubEventKind, string> = {
  bolus: "boluses",
  meal: "meals",
  rescue: "rescues",
  basal: "basal doses",
  activity: "activities",
};

export const eventIcon: Record<HubEventKind, string> = {
  bolus: "syringe",
  meal: "restaurant",
  rescue: "water_drop",
  basal: "shield_with_heart",
  activity: "directions_run",
};

export const eventKindName: Record<HubEventKind, string> = {
  bolus: "Bolus",
  meal: "Meal",
  rescue: "Rescue glucose",
  basal: "Basal",
  activity: "Activity",
};

/** Insulin on board from all boluses at time `t` (ms). */
export function totalIOB(boluses: Insulin[], t: number): number {
  const at = new Date(t);
  let sum = 0;
  for (const b of boluses) {
    if (t >= b.timestamp.getTime()) sum += b.iob(at);
  }
  return sum;
}

function when(time: number, nowMs: number) {
  return `${formatClock(time)} · ${formatRelative(time, nowMs)}`;
}

function activitySpan(a: Activity, nowMs: number) {
  const start = a.snapshot.initialBG?.timestamp.getTime();
  if (start === undefined) return null;
  const end = a.snapshot.finalBG?.timestamp.getTime() ?? nowMs;
  return { start, end, ongoing: !a.snapshot.finalBG };
}

export function buildHubEvents({
  boluses,
  rescues,
  mealSessions,
  basalDoses,
  basalTimes,
  activities,
  nowMs,
}: {
  boluses: Insulin[];
  rescues: Glucose[];
  mealSessions: MealSession[];
  basalDoses: Insulin[];
  basalTimes: number[];
  activities: Activity[];
  nowMs: number;
}): HubEvent[] {
  const events: HubEvent[] = [];
  // Which meal session a treatment was logged in (matched by its timestamp).
  const sessionOf = new Map<number, string>();
  for (const { session, name } of mealSessions) {
    for (const ins of session.insulins)
      sessionOf.set(ins.timestamp.getTime(), name);
    for (const g of session.glucoses)
      sessionOf.set(g.timestamp.getTime(), name);
  }
  const sessionRow = (time: number) => {
    const name = sessionOf.get(time);
    return name ? [{ label: "Session", value: name }] : [];
  };

  boluses.forEach((b, i) => {
    const time = b.timestamp.getTime();
    events.push({
      id: `bolus-${time}-${i}`,
      kind: "bolus",
      time,
      label: `${formatDose(b.value)}u`,
      amount: b.value,
      title: `${formatDose(b.value)}u ${b.variant.name}`,
      details: [
        { label: "Given", value: when(time, nowMs) },
        {
          label: "Still on board",
          value: `${formatDose(b.iob(new Date(nowMs)))}u`,
        },
        {
          label: "Activity now",
          value: `${formatDose(b.absorptionRate(new Date(nowMs)))} u/hr`,
        },
        ...sessionRow(time),
      ],
    });
  });

  mealSessions.forEach(({ session, name }) => {
    const meal = session.meal;
    if (!meal) return;
    const time = meal.timestamp.getTime();
    const carbs = meal.carbs;
    events.push({
      id: `meal-${session.uuid}`,
      kind: "meal",
      time,
      label: name,
      amount: carbs,
      title: name,
      mealName: name,
      session,
      details: [
        { label: "Eaten", value: when(time, nowMs) },
        { label: "Net carbs", value: formatGrams(carbs) },
        { label: "Protein", value: formatGrams(meal.protein) },
      ],
    });
  });

  rescues.forEach((r, i) => {
    const time = r.timestamp.getTime();
    events.push({
      id: `rescue-${time}-${i}`,
      kind: "rescue",
      time,
      label: formatGrams(r.carbs),
      amount: r.carbs,
      title: `${r.value} × ${r.variant.name}`,
      details: [
        { label: "Taken", value: when(time, nowMs) },
        { label: "Carbs", value: formatGrams(r.carbs) },
        ...sessionRow(time),
      ],
    });
  });

  // Basal: local doses carry the amount; Nightscout times fill in any
  // shot not logged on this device.
  const localBasalTimes = basalDoses.map((d) => d.timestamp.getTime());
  basalDoses.forEach((d, i) => {
    const time = d.timestamp.getTime();
    events.push({
      id: `basal-${time}-${i}`,
      kind: "basal",
      time,
      label: `${formatDose(d.value)}u`,
      amount: d.value,
      title: `${formatDose(d.value)}u ${d.variant.name}`,
      details: [{ label: "Given", value: when(time, nowMs) }],
    });
  });
  basalTimes.forEach((time, i) => {
    if (localBasalTimes.some((t) => Math.abs(t - time) < 60 * 1000)) return;
    events.push({
      id: `basal-ns-${time}-${i}`,
      kind: "basal",
      time,
      label: "Basal",
      title: "Basal insulin",
      details: [{ label: "Given", value: when(time, nowMs) }],
    });
  });

  activities.forEach((a, i) => {
    const span = activitySpan(a, nowMs);
    if (!span) return;
    const minutes = Math.round((span.end - span.start) / 60000);
    events.push({
      id: `activity-${span.start}-${i}`,
      kind: "activity",
      time: span.start,
      end: span.end,
      label: a.name || "Activity",
      title: a.name || "Activity",
      details: [
        { label: "Started", value: when(span.start, nowMs) },
        {
          label: span.ongoing ? "Ongoing for" : "Duration",
          value: `${minutes} min`,
        },
      ],
    });
  });

  return events.sort((a, b) => a.time - b.time);
}
