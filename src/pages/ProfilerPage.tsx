import { Button } from "react-bootstrap";
import ProfilerMealDisplay from "../components/ProfilerMealDisplay";
import ProfileSlider from "../components/ProfileSlider";
import useImportedMealsState from "../state/useImportedMealsState";
import NightscoutManager from "../lib/nightscoutManager";

export default function ProfilerPage() {
  const { importedMeals } = useImportedMealsState();

  function unhideMeals() {
    NightscoutManager.clearIgnoredUUIDs();
  }
  return (
    <>
      <ProfileSlider variable="einsulin"></ProfileSlider>
      <ProfileSlider variable="pinsulin"></ProfileSlider>
      <ProfileSlider variable="ninsulin"></ProfileSlider>
      <br></br>
      <ProfileSlider variable="ecarbs"></ProfileSlider>
      <ProfileSlider variable="pcarbs"></ProfileSlider>
      <ProfileSlider variable="ncarbs"></ProfileSlider>
      <br></br>
      <ProfileSlider variable="eprotein"></ProfileSlider>
      <ProfileSlider variable="nprotein"></ProfileSlider>
      <ProfileSlider
        variable="cprotein"
        prettyName="Protein Minimum Digestion Time (hours)"
      ></ProfileSlider>
      <ProfileSlider
        variable="pprotein"
        prettyName="Protein Sustain Rate (hours/gram)"
      ></ProfileSlider>
      <br></br>
      <Button variant="secondary" onClick={unhideMeals}>
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
