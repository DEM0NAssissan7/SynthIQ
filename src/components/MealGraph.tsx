import { useEffect, useState } from "react";
import type Meal from "../models/meal";
import Graph from "./Graph";
import Series, { Color } from "../models/series";
import ReadingSeries from "../models/readingSeries";
import MathSeries from "../models/mathSeries";

interface MealGraphProps {
  meal: Meal;
  from: number;
  until: number;
  width?: string | number;
  height?: string | number;
  ymin?: string | number;
}

function MealGraph({ meal, from, until, width, height }: MealGraphProps) {
  const [readingSeries, setReadingSeries] = useState<ReadingSeries>(
    new ReadingSeries(Color.Black, new Date())
  );
  const [predictionSeries, setPredictionSeries] = useState<MathSeries>(
    new MathSeries(Color.Blue, [])
  );

  console.log(meal);
  useEffect(() => {
    const mealGraphHandler = () => {
      // if (initialGlucose) meal.setInitialGlucose(initialGlucose);
      setPredictionSeries(meal.getPredictionSeries(from, until));
    };
    meal.subscribe(mealGraphHandler);

    return () => {
      meal.unsubscribe(mealGraphHandler);
    };
  });

  useEffect(() => {
    setReadingSeries(meal.getReadingSeries(from, until));
  }, [from, until]);

  return (
    <Graph
      series={[readingSeries, predictionSeries]}
      ymin={60}
      xmin={from}
      xmax={until}
      width={width}
      height={height}
    ></Graph>
  );
}

export default MealGraph;
