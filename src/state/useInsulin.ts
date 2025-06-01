import { useState } from "react";
import type Meal from "../models/meal";
import type Insulin from "../models/insulin";
import { getMinuteDiff, getTimestampFromOffset } from "../lib/timing";

export default function useInsulin(insulin: Insulin, meal: Meal) {
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const notify = () => {
    meal.notify();
    rerender();
  }
  let offset = getMinuteDiff(insulin.timestamp, meal.timestamp);
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
        insulin.timestamp = getTimestampFromOffset(meal.timestamp, minutes / 60);
        notify();
    }
  };
}
