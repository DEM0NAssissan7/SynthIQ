import { useState } from "react";
import { getMinuteDiff, getTimestampFromOffset } from "../lib/timing";
import type Session from "../models/session";
import type Glucose from "../models/events/glucose";

export default function useGlucose(glucose: Glucose, session: Session) {
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  let offset = getMinuteDiff(glucose.timestamp, session.firstMealTimestamp);
  return {
    caps: glucose.caps,
    timestamp: glucose.timestamp,
    offset: offset,
    setCaps: (caps: number) => {
      glucose.caps = caps;
      rerender();
    },
    setTimestamp: (timestamp: Date) => {
      glucose.timestamp = timestamp;
      rerender();
    },
    setTimestampFromOffset: (minutes: number) => {
      offset = minutes; // This is kinda cheating, but it helps with the text box
      glucose.timestamp = getTimestampFromOffset(
        session.firstMealTimestamp,
        minutes / 60
      );
      rerender();
    },
  };
}
