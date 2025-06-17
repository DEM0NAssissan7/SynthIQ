import { useState } from "react";
import type Insulin from "../models/insulin";
import { getMinuteDiff, getTimestampFromOffset } from "../lib/timing";
import type MetaEvent from "../models/event";

export default function useInsulin(insulin: Insulin, event: MetaEvent) {
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const notify = () => {
    event.notify();
    rerender();
  };
  let offset = getMinuteDiff(insulin.timestamp, event.timestamp);
  return {
    units: insulin.units,
    timestamp: insulin.timestamp,
    offset: offset,
    setUnits: (units: number) => {
      insulin.units = units;
      notify();
    },
    setTimestamp: (timestamp: Date) => {
      insulin.timestamp = timestamp;
      notify();
    },
    setTimestampFromOffset: (minutes: number) => {
      offset = minutes; // This is kinda cheating, but it helps with the text box
      insulin.timestamp = getTimestampFromOffset(event.timestamp, minutes / 60);
      notify();
    },
  };
}
