import { Button } from "react-bootstrap";
import ProfilerMealDisplay from "../components/ProfilerMealDisplay";
import ProfileSlider from "../components/ProfileSlider";
import useImportedMealsState from "../state/useImportedMealsState";
import useProfileState from "../state/useProfileState";

export default function ProfilerPage() {
  const { importedMeals, clearIgnoredMeals, ignoreMeal } =
    useImportedMealsState();
  const profile = useProfileState();

  return (
    <>
      <div style={{ display: "flex" }}>
        <div
          id="sliders"
          style={{
            minWidth: 350,
            maxWidth: 350,
            flexShrink: 0,
            marginRight: 32,
          }}
        >
          <ProfileSlider
            value={profile.insulin.effect}
            setValue={(value) => (profile.insulin.effect = value)}
            prettyName="Insulin Effect (points/u)"
          />
          <ProfileSlider
            value={profile.insulin.halfLife}
            setValue={(value) => (profile.insulin.halfLife = value)}
            prettyName="Insulin Half-life (hours)"
          />
          <ProfileSlider
            value={profile.insulin.delay}
            setValue={(value) => (profile.insulin.delay = value)}
            prettyName="Insulin Delay (hours)"
          />

          <br />
          <ProfileSlider
            value={profile.carbs.effect}
            setValue={(value) => (profile.carbs.effect = value)}
            prettyName="Carbs Effect (points/g)"
          />
          <ProfileSlider
            value={profile.carbs.peak}
            setValue={(value) => (profile.carbs.peak = value)}
            prettyName="Carbs Peak (hours)"
          />
          <ProfileSlider
            value={profile.carbs.delay}
            setValue={(value) => (profile.carbs.delay = value)}
            prettyName="Carbs Delay (hours)"
          />

          <br />
          <ProfileSlider
            value={profile.protein.effect}
            setValue={(value) => (profile.protein.effect = value)}
            prettyName="Protein Effect (points/g)"
          />
          <ProfileSlider
            value={profile.protein.delay}
            setValue={(value) => (profile.protein.delay = value)}
            prettyName="Protein Delay (hours)"
          />
          <ProfileSlider
            value={profile.protein.minTime}
            setValue={(value) => (profile.protein.minTime = value)}
            prettyName="Protein Minimum Digestion Time (hours)"
          />
          <ProfileSlider
            value={profile.protein.plateuRate}
            setValue={(value) => (profile.protein.plateuRate = value)}
            prettyName="Protein Sustain Rate (hours/g)"
            step={0.001}
          />
        </div>

        <div id="meals">
          <Button variant="secondary" onClick={clearIgnoredMeals}>
            Unhide All
          </Button>
          {importedMeals.map((meal, i) => (
            <ProfilerMealDisplay
              meal={meal}
              key={i}
              ignoreMeal={ignoreMeal}
              from={-1}
              until={
                meal.endTimestamp
                  ? Math.floor(meal.getN(meal.endTimestamp)) + 1
                  : 16
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}
