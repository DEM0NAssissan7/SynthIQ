import { useEffect, useMemo, useState } from "react";
import type Meal from "../models/meal";
import Graph, { type SeriesLine } from "./Graph";
import { Color } from "../models/series";
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

  const [version, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1); // force re-render

  useEffect(() => {
    // Update the reading series
    setReadingSeries(meal.getReadingSeries(from, until));

    const mealGraphHandler = () => {
      requestAnimationFrame(() => {
        setPredictionSeries(meal.getPredictionSeries(from, until));
        rerender();
      });
    };
    meal.subscribe(mealGraphHandler);

    return () => {
      meal.unsubscribe(mealGraphHandler);
    };
  }, [meal, from, until]);

  // Notify meal on load to update the graph prediction series
  useEffect(() => {
    meal.notify();
  }, []);

  const lines = useMemo(() => {
    let lines: SeriesLine[] = [];
    lines.push({
      x: 0,
      color: "black",
    });
    meal.insulins.forEach((insulin) => {
      lines.push({
        x: meal.getN(insulin.timestamp),
        color: "red",
      });
    });
    meal.testInsulins.forEach((insulin) => {
      lines.push({
        x: meal.getN(insulin.timestamp),
        color: "blue",
      });
    });
    return lines;
  }, [meal, version]);
  return (
    <Graph
      series={[readingSeries, predictionSeries]}
      lines={lines}
      ymin={60}
      xmin={from}
      xmax={until}
      width={width}
      height={height}
    ></Graph>
  );
}

export default MealGraph;
