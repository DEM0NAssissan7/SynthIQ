import type Session from "../models/session";
import { Graph, type Marker } from "./Graph";

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
  let markers: Marker[] = [
    ...session.insulins.map((i) => {
      return {
        kind: "line",
        x: session.getRelativeN(i.timestamp),
        label: `${i.value}u ${i.variant.name}`,
        color: "#2563eb",
      } as Marker;
    }),
    ...session.glucoses.map((g) => {
      return {
        kind: "line",
        x: session.getRelativeN(g.timestamp),
        label: `${g.value} ${g.variant.name}`,
        color: "#b165b2ff",
      } as Marker;
    }),
  ];
  session.activities.forEach((a) => {
    markers.push({
      kind: "line",
      x: session.getRelativeN(a.timestamp),
      label: `${a.name} began`,
      color: "#d58a3fff",
    } as Marker);
    markers.push({
      kind: "line",
      x: session.getRelativeN(a.endTimestamp),
      label: `${a.name} ended`,
      color: "#d58a3fff",
    } as Marker);
  });

  return (
    <Graph
      points={points}
      markers={markers}
      xLabel="Time since first meal (hours)"
      yLabel="mg/dL"
    />
  );
}
