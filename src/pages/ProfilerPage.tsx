import { Button } from "react-bootstrap";
import ProfilerMealDisplay from "../components/ProfilerMealDisplay";
import ProfileSlider from "../components/ProfileSlider";
import useImportedMealsState from "../state/useImportedMealsState";
import useProfileState from "../state/useProfileState";
import { useEffect } from "react";

export default function ProfilerPage() {
  const { importedMeals, clearIgnoredMeals } = useImportedMealsState();
  const profile = useProfileState();

  useEffect(() => {
    importedMeals.forEach((meal) => {
      const mealUpdateHandler = () => meal.notify();
      profile.subscribe(mealUpdateHandler);
    });
    return () => {
      importedMeals.forEach((meal) => {
        const mealUpdateHandler = () => meal.notify();
        profile.unsubscribe(mealUpdateHandler);
      });
    };
  }, [importedMeals]);

  return (
    <>
      <ProfileSlider
        value={profile.insulin.effect}
        setValue={(value) => (profile.insulin.effect = value)}
        prettyName="Insulin Effect (points/u)"
      ></ProfileSlider>
      <ProfileSlider
        value={profile.insulin.halfLife}
        setValue={(value) => (profile.insulin.halfLife = value)}
        prettyName="Insulin Half-life (hours)"
      ></ProfileSlider>
      <ProfileSlider
        value={profile.insulin.delay}
        setValue={(value) => (profile.insulin.delay = value)}
        prettyName="Insulin Delay (hours)"
      ></ProfileSlider>

      <br />
      <ProfileSlider
        value={profile.carbs.effect}
        setValue={(value) => (profile.carbs.effect = value)}
        prettyName="Carbs Effect (points/g)"
      ></ProfileSlider>
      <ProfileSlider
        value={profile.carbs.peak}
        setValue={(value) => (profile.carbs.peak = value)}
        prettyName="Carbs Peak (hours)"
      ></ProfileSlider>
      <ProfileSlider
        value={profile.carbs.delay}
        setValue={(value) => (profile.carbs.delay = value)}
        prettyName="Carbs Delay (hours)"
      ></ProfileSlider>

      <br />
      <ProfileSlider
        value={profile.protein.effect}
        setValue={(value) => (profile.protein.effect = value)}
        prettyName="Protein Effect (points/g)"
      ></ProfileSlider>
      <ProfileSlider
        value={profile.protein.delay}
        setValue={(value) => (profile.protein.delay = value)}
        prettyName="Protein Delay (hours)"
      ></ProfileSlider>
      <ProfileSlider
        value={profile.protein.minTime}
        setValue={(value) => (profile.protein.minTime = value)}
        prettyName="Protein Minimum Digestion Time (hours)"
      ></ProfileSlider>
      <ProfileSlider
        value={profile.protein.plateuRate}
        setValue={(value) => (profile.protein.plateuRate = value)}
        prettyName="Protein Sustain Rate (hours/g)"
        step={0.001}
      ></ProfileSlider>
      <br />

      <Button variant="secondary" onClick={clearIgnoredMeals}>
        Unhide All
      </Button>
      {importedMeals.map((meal) => (
        <ProfilerMealDisplay
          meal={meal}
          key={meal.uuid}
          from={-1}
          until={24}
        ></ProfilerMealDisplay>
      ))}
    </>
  );
}
