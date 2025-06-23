import { useEffect, useMemo, useState } from "react";
import type Meal from "../models/events/meal";
import Graph, { type SeriesLine } from "./Graph";
import { Color } from "../models/series";
import ReadingSeries from "../models/readingSeries";
import MathSeries from "../models/mathSeries";
import type Insulin from "../models/events/insulin";
import type Glucose from "../models/events/glucose";
import type Session from "../models/session";

interface SessionGraphProps {
  session: Session;
  from: number;
  until?: number;
  width?: string | number;
  height?: string | number;
  ymin?: string | number;
}

function SessionGraph({
  session,
  from,
  until,
  width,
  height,
}: SessionGraphProps) {
  const [readingSeries, setReadingSeries] = useState<ReadingSeries>(
    new ReadingSeries(Color.Black, new Date())
  );
  const [predictionSeries, setPredictionSeries] = useState<MathSeries>(
    new MathSeries(Color.Blue, [])
  );

  const minXmax = 8;
  const xmax = useMemo(() => {
    return until || Math.max(Math.floor(session.getN(new Date())) + 2, minXmax);
  }, [until, session]);

  const [version, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1); // force re-render

  useEffect(() => {
    // Update the reading series
    setReadingSeries(session.getReadingSeries(from, xmax));

    const sessionGraphHandler = () => {
      requestAnimationFrame(() => {
        setPredictionSeries(session.getPredictionSeries(from, xmax));
        rerender();
      });
    };
    session.subscribe(sessionGraphHandler);

    return () => {
      session.unsubscribe(sessionGraphHandler);
    };
  }, [session, from, until]);

  // Notify session on load to update the graph prediction series
  useEffect(() => {
    session.notify();
  }, []);

  const lines = useMemo(() => {
    let lines: SeriesLine[] = [];

    session.meals.forEach((meal: Meal) => {
      lines.push({
        x: session.getN(meal.timestamp),
        color: "black",
      });
    });
    session.testMeals.forEach((meal: Meal) => {
      lines.push({
        x: session.getN(meal.timestamp),
        color: "black",
      });
    });

    session.insulins.forEach((insulin: Insulin) => {
      lines.push({
        x: session.getN(insulin.timestamp),
        color: "blue",
      });
    });
    session.testInsulins.forEach((insulin: Insulin) => {
      lines.push({
        x: session.getN(insulin.timestamp),
        color: "red",
      });
    });

    session.glucoses.forEach((glucose: Glucose) => {
      lines.push({
        x: session.getN(glucose.timestamp),
        color: "orange",
      });
    });
    session.testGlucoses.forEach((glucose: Glucose) => {
      lines.push({
        x: session.getN(glucose.timestamp),
        color: "red",
      });
    });

    return lines;
  }, [session, version]);
  return (
    <Graph
      series={[readingSeries, predictionSeries]}
      lines={lines}
      ymin={60}
      xmin={from}
      xmax={xmax}
      width={width}
      height={height}
    ></Graph>
  );
}

export default SessionGraph;
