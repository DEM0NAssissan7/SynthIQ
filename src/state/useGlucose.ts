import { useState } from "react";
import { getMinuteDiff, getTimestampFromOffset } from "../lib/timing";
import type MetaEvent from "../models/event";
import type Glucose from "../models/glucose";

export default function useGlucose(glucose: Glucose, event: MetaEvent) {
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const notify = () => {
    event.notify();
    rerender();
  };
  let offset = getMinuteDiff(glucose.timestamp, event.latestMealTimestamp);
  return {
    caps: glucose.caps,
    timestamp: glucose.timestamp,
    offset: offset,
    setCaps: (caps: number) => {
      glucose.caps = caps;
      notify();
    },
    setTimestamp: (timestamp: Date) => {
      glucose.timestamp = timestamp;
      notify();
    },
    setTimestampFromOffset: (minutes: number) => {
      offset = minutes; // This is kinda cheating, but it helps with the text box
      glucose.timestamp = getTimestampFromOffset(
        event.latestMealTimestamp,
        minutes / 60
      );
      notify();
    },
  };
}
