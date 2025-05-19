import Graph from "./components/Graph";
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
  const s = meal.createSeriesList(initialGlucose, 10);
  console.log(s);

  return <Graph series={s}></Graph>;
}

export default ProfilerPage;
