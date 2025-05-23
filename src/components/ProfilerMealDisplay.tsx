import { useEffect } from "react";
import type Meal from "../models/meal";
import MealGraph from "./MealGraph";
import { profile } from "../storage/metaProfileStore";
import { Button } from "react-bootstrap";
import { getFullPrettyDate } from "../lib/timing";
import { round } from "../lib/util";

interface ProfilerMealDisplayProps {
  meal: Meal;
  ignoreMeal: (a: Meal) => void;
  from: number;
  until: number;
  width?: string | number;
  height?: string | number;
  ymin?: string | number;
}

export default function ProfilerMealDisplay({
  meal,
  ignoreMeal,
  from,
  until,
  width,
  height,
  ymin,
}: ProfilerMealDisplayProps) {
  useEffect(() => {
    /** We subscribe to the metaProfile storage node to be notified whenever
     * the profile changes, to notify all subscribers to the meal, so that
     * we can display real-time data when the sliders move.
     */
    let animationFrameId: number = 0;
    const profilerSubscriberNotifierHandler = () => {
      if (!animationFrameId)
        animationFrameId = requestAnimationFrame(() => {
          meal.notify();
          animationFrameId = 0;
        });
    };

    profile.subscribe(profilerSubscriberNotifierHandler);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      profile.unsubscribe(profilerSubscriberNotifierHandler);
    };
  }, []);

  // Ignore Meal
  function onIgnoreClick() {
    if (
      confirm(`Are you sure you want to ignore this meal? UUID: ${meal.uuid}`)
    ) {
      ignoreMeal(meal);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <MealGraph
        meal={meal}
        from={from}
        until={until}
        width={width}
        height={height}
        ymin={ymin}
      />
      {getFullPrettyDate(meal.timestamp)}
      <br />
      {round(meal.carbs, 2)}g carbs
      <br />
      {round(meal.protein, 2)}g protein
      <br />
      {round(meal.fat, 2)}g fat
      <br />
      {meal.insulin}u insulin
      {meal.glucose > 0 && (
        <>
          <br />
          {meal.glucose} caps of glucose
        </>
      )}
      <Button variant="danger" onClick={onIgnoreClick}>
        Ignore
      </Button>
    </div>
  );
}
