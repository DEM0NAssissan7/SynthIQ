import { useEffect, useMemo, useState } from "react";
import type Meal from "../models/meal";
import Graph, { type SeriesLine } from "./Graph";
import { Color } from "../models/series";
import ReadingSeries from "../models/readingSeries";
import MathSeries from "../models/mathSeries";
import type Insulin from "../models/insulin";
import type Glucose from "../models/glucose";
import type MetaEvent from "../models/event";

interface EventGraphProps {
  event: MetaEvent;
  from: number;
  until: number;
  width?: string | number;
  height?: string | number;
  ymin?: string | number;
}

function EventGraph({ event, from, until, width, height }: EventGraphProps) {
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
    setReadingSeries(event.getReadingSeries(from, until));

    const eventGraphHandler = () => {
      requestAnimationFrame(() => {
        setPredictionSeries(event.getPredictionSeries(from, until));
        rerender();
      });
    };
    event.subscribe(eventGraphHandler);

    return () => {
      event.unsubscribe(eventGraphHandler);
    };
  }, [event, from, until]);

  // Notify event on load to update the graph prediction series
  useEffect(() => {
    event.notify();
  }, []);

  const lines = useMemo(() => {
    let lines: SeriesLine[] = [];

    event.meals.forEach((meal: Meal) => {
      lines.push({
        x: event.getN(meal.timestamp),
        color: "black",
      });
    });
    event.testMeals.forEach((meal: Meal) => {
      lines.push({
        x: event.getN(meal.timestamp),
        color: "black",
      });
    });

    event.insulins.forEach((insulin: Insulin) => {
      lines.push({
        x: event.getN(insulin.timestamp),
        color: "blue",
      });
    });
    event.testInsulins.forEach((insulin: Insulin) => {
      lines.push({
        x: event.getN(insulin.timestamp),
        color: "red",
      });
    });

    event.glucoses.forEach((glucose: Glucose) => {
      lines.push({
        x: event.getN(glucose.timestamp),
        color: "orange",
      });
    });
    event.testGlucoses.forEach((glucose: Glucose) => {
      lines.push({
        x: event.getN(glucose.timestamp),
        color: "red",
      });
    });

    return lines;
  }, [event, version]);
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

export default EventGraph;
