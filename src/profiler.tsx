import Graph from "./components/Graph";
import ProfileSlider from "./components/ProfileSlider";
import NightscoutManager from "./lib/nightscoutManager";
import Meal from "./models/meal";

function ProfilerPage() {
  const time = new Date("14:59 5-18-2025");
  const meal = new Meal(time);
  const carbs = 10;
  const protein = 40;
  meal.setOffsets(carbs, protein);
  meal.insulin(new Date("14:53 5-18-2025"), 4.5);

  let initialGlucose = 120;
  meal.getInitialGlucose().then((a: any) => (initialGlucose = a));
  const s = meal.createSeriesList(initialGlucose, -1, 10);
  console.log(s);

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
        variable="rprotein"
        prettyName="Protein Rise"
      ></ProfileSlider>
      <ProfileSlider
        variable="pprotein"
        prettyName="Protein Plateau"
      ></ProfileSlider>
      <ProfileSlider
        variable="fprotein"
        prettyName="Protein Fall"
      ></ProfileSlider>
      <br></br>
      <Graph series={s} width="100%" height={200} xmax={12}></Graph>
    </>
  );
}

export default ProfilerPage;
