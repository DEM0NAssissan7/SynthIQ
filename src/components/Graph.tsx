import { useEffect, useState } from "react";
import Series from "../models/series";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

interface GraphProps {
  series: Series[];
  ymin?: string | number;
  width?: string | number;
  height?: string | number;
  xmin?: number;
  xmax?: number;
}

export default function Graph({
  series,
  ymin = "auto",
  width = 600,
  height = 200,
  xmin = -1,
  xmax = 9,
}: GraphProps) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    let animationFrameId: number | null = null;

    const callback = () => {
      if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(() => {
          setVersion((v) => v + 1);
          animationFrameId = null;
        });
      }
    };

    series.forEach((s) => s.subscribe(callback));

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      series.forEach((s) => s.unsubscribe(callback));
    };
  }, [series]);

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart>
          <CartesianGrid stroke="#ccc" strokeDasharray="10 5" />

          {
            // Create a line set for each piece of data
            series.map((s) => {
              return (
                <Line
                  type="monotone"
                  data={s.getRechartData()}
                  dataKey="y"
                  stroke={s.color}
                  dot={false}
                ></Line>
              );
            })
          }

          <XAxis
            type="number"
            dataKey="x"
            domain={[xmin, xmax]}
            allowDataOverflow={true}
            tickCount={xmax - xmin + 1}
          />
          <YAxis type="number" domain={[ymin, "auto"]} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
