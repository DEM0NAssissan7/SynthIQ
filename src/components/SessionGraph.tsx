import type Session from "../models/session";
import { Graph } from "./Graph";

interface SessionGraphProps {
  session: Session;
}

export default function SessionGraph({ session }: SessionGraphProps) {
  let points = session.snapshot.readings.map((r) => {
    return {
      x: session.getRelativeN(r.timestamp),
      y: r.sugar,
    };
  });
  return (
    <Graph
      points={points}
      xLabel="Time since first meal (hours)"
      yLabel="mg/dL"
    />
  );
}
