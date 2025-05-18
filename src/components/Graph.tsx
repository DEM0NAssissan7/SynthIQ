import { useEffect, useState } from "react";
import Series from "../models/series";

import { LineChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";

interface GraphProps {
  series: Series[];
  min?: string;
}

export default function Graph({ series, min }: GraphProps) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    // for each series, subscribe once on mount...
    const callbacks = series.map(() => () => setVersion((v) => v + 1));

    series.forEach((s, i) => {
      s.subscribe(callbacks[i]);
    });

    return () => {
      series.forEach((s, i) => {
        s.unsubscribe(callbacks[i]);
      });
    };
  });

  return (
    <LineChart width={600} height={300}>
      <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />

      {
        // Create a line set for each piece of data
        series.map((s) => {
          return (
            <Line
              type="monotone"
              data={s.getRechartData()}
              dataKey="y"
              stroke={s.color}
            ></Line>
          );
        })
      }

      <XAxis type="number" dataKey="x" domain={["auto", "auto"]} />
      <YAxis type="number" domain={[min || "auto", "auto"]} />
    </LineChart>
  );
}
