import { useEffect } from "react";
import type Meal from "../models/meal";
import MealGraph from "./MealGraph";
import { metaProfile } from "../lib/metabolism";

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

  return (
    <>
      <MealGraph meal={meal} from={from} until={until}></MealGraph>
    </>
  );
}
