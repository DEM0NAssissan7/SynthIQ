import { useEffect } from "react";
import type Meal from "../models/meal";
import MealGraph from "./MealGraph";
import metaProfile from "../storage/metaProfileStore";
import { Button } from "react-bootstrap";
import useImportedMealsState from "../state/useImportedMealsState";
import { getFullPrettyDate } from "../lib/timing";

interface ProfilerMealDisplayProps {
  meal: Meal;
  from: number;
  until: number;
  width?: string | number;
  height?: string | number;
  ymin?: string | number;
}

export default function ProfilerMealDisplay({
  meal,
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

    metaProfile.subscribeGeneral(profilerSubscriberNotifierHandler);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      metaProfile.unsubscribeGeneral(profilerSubscriberNotifierHandler);
    };
  }, [meal, metaProfile]);

  // Ignore Meal
  const { ignoreMeal } = useImportedMealsState();
  function onIgnoreClick() {
    if (
      confirm(`Are you sure you want to ignore this meal? UUID: ${meal.uuid}`)
    )
      ignoreMeal(meal);
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
      {meal.carbs}g carbs
      <br />
      {meal.protein}g protein
      <br />
      {meal.fat}g fat
      <br />
      {meal.insulin}u insulin
      <Button variant="danger" onClick={onIgnoreClick}>
        Ignore
      </Button>
    </div>
  );
}
