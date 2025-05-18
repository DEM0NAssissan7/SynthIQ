import Graph from "./components/Graph";
import ReadingSeries from "./models/readingSeries";
import { Color } from "./models/series";

function App() {
  const time = new Date("14:59 5-18-2025");
  let s = new ReadingSeries(Color.Blue, time);
  s.populate(new Date("14:00 5-18-2025"), new Date("20:00 5-18-2025"));

  console.log(s);
  const carbs = 10;
  const protein = 40;

  return (
    <div>
      <Graph series={[s]}></Graph>
    </div>
  );
}

export default App;
