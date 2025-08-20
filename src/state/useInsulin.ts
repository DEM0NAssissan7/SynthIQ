import { useState } from "react";
import type Insulin from "../models/events/insulin";
import { getMinuteDiff, getTimestampFromOffset } from "../lib/timing";
import type Session from "../models/session";

export default function useInsulin(insulin: Insulin, session: Session) {
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  let offset = getMinuteDiff(insulin.timestamp, session.firstMealTimestamp);
  return {
    units: insulin.value,
    timestamp: insulin.timestamp,
    offset: offset,
    setUnits: (units: number) => {
      insulin.value = units;
      rerender();
    },
    setTimestamp: (timestamp: Date) => {
      insulin.timestamp = timestamp;
      rerender();
    },
    setTimestampFromOffset: (minutes: number) => {
      offset = minutes; // This is kinda cheating, but it helps with the text box
      insulin.timestamp = getTimestampFromOffset(
        session.firstMealTimestamp,
        minutes / 60
      );
      rerender();
    },
  };
}
