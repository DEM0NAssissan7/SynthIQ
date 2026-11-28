import { SessionManager } from "../../managers/sessionManager";
import { StreamManager } from "../../managers/streamManager";
import type { Stream } from "../../models/stream";
import type SugarReading from "../../models/types/sugarReading";
import { ReadingType } from "../../models/types/sugarReading";
import type { DateRange } from "../../models/types/types";
import { getTimestampFromOffset } from "../timing";
import { firstIndexWhere } from "../util";
import { estimateDynamicMetabolicActivity } from "./estimateDynamicISF";

/** Whether a time falls in any of the spans [start, end) */
function within(spans: DateRange[]): (t: Date) => boolean {
  // Merged into disjoint spans in order, so one binary search finds the only candidate
  const merged: [number, number][] = [];
  for (const [a, b] of spans
    .map(([a, b]): [number, number] => [a.getTime(), b.getTime()])
    .sort((x, y) => x[0] - y[0])) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return (t) => {
    const time = t.getTime();
    const i = firstIndexWhere(merged, ([, b]) => b > time);
    return i < merged.length && merged[i][0] <= time;
  };
}

/**
 * Fasting insulin sensitivity: mg/dL one unit of correction insulin drops
 * blood sugar outside of meals. Sessions are where meals act, so the
 * estimator sees only what no session holds: the doses taken outside every
 * session (corrections) and the CGM readings outside every session. Sessions
 * are made of the stream's own events and readings, so that is membership,
 * not a time window. Activities still act on blood sugar outside sessions,
 * so readings during one are left out, and rescues are passed whole for the
 * estimator to leave out the windows they influence.
 */
export function getISF0(stream: Stream = StreamManager.stream): number {
  const sessions = SessionManager.getSessions();
  const sessionInsulins = new Set(sessions.flatMap((s) => s.insulins));
  const sessionReadings = new Set<SugarReading>(
    sessions.flatMap((s) => s.snapshot.readings),
  );

  const corrections = stream.insulins.filter((i) => !sessionInsulins.has(i));
  const inActivity = within(
    stream.activities.map((a): DateRange => [
      a.timestamp,
      getTimestampFromOffset(a.timestamp, a.value / 60), // Minutes to hours
    ]),
  );
  const readings = stream.snapshot.readings.filter(
    (r) =>
      r.type === ReadingType.Normal &&
      !sessionReadings.has(r) &&
      !inActivity(r.timestamp),
  );

  // No meals: sessions already are the meals' bounds
  return estimateDynamicMetabolicActivity(
    readings,
    corrections,
    stream.rescues,
    false,
    null,
  )[0];
}
