import ProfileSlider from "./components/ProfileSlider";
import Meal from "./models/meal";
import ProfilerMealDisplay from "./components/ProfilerMealDisplay";
import { useEffect, useState } from "react";
import NightscoutManager from "./lib/nightscoutManager";

function ProfilerPage() {
  const [importedMeals, setImportedMeals] = useState<Meal[]>([]);

  useEffect(() => {
    NightscoutManager.getAllMeals().then((m) => {
      setImportedMeals(m);
    });
  }, []);

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
      {importedMeals.map((meal) => (
        <ProfilerMealDisplay
          meal={meal}
          from={-1}
          until={24}
        ></ProfilerMealDisplay>
      ))}
    </>
  );
}

export default ProfilerPage;
