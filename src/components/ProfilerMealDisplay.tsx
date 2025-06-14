import type Meal from "../models/meal";
import MealGraph from "./MealGraph";
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
