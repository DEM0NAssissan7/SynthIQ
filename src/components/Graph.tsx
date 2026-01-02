import { useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

export type XYPoint = { x: number; y: number };

export type GraphProps = {
  points: XYPoint[];
  xPadding?: number; // default 0
  yPadding?: number; // default 10
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  seriesLabel?: string;
  showLegend?: boolean;
};

function extent(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  let min = values[0]!;
  let max = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    const bump = min === 0 ? 1 : Math.abs(min) * 0.01;
    return [min - bump, max + bump];
  }
  return [min, max];
}

function formatHours(h: number) {
  const sign = h < 0 ? "-" : "";
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  const adjH = mm === 60 ? hh + 1 : hh;
  const adjM = mm === 60 ? 0 : mm;
  return `${sign}${adjH}:${String(adjM).padStart(2, "0")}`;
}

export function Graph({
  points,
  xPadding = 0,
  yPadding = 10,
  width = 800,
  height = 300,
  xLabel = "x",
  yLabel = "y",
  seriesLabel = "series",
  showLegend = false,
}: GraphProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  const prepared = useMemo(() => {
    // Coerce + filter invalid values (this is usually the culprit)
    const cleaned = (points ?? [])
      .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);

    const xs = cleaned.map((p) => p.x);
    const ys = cleaned.map((p) => p.y);

    const [xMin, xMax] = extent(xs);
    const [yMin, yMax] = extent(ys);

    return { xs, ys, xMin, xMax, yMin, yMax, cleanedCount: cleaned.length };
  }, [points]);

  useEffect(() => {
    if (!hostRef.current) return;

    plotRef.current?.destroy();
    plotRef.current = null;

    const { xs, ys, xMin, xMax, yMin, yMax } = prepared;

    const opts: uPlot.Options = {
      width,
      height,
      axes: [
        { label: xLabel, values: (_u, ticks) => ticks.map(formatHours) },
        { label: yLabel },
      ],
      legend: { show: showLegend },
      scales: {
        x: { range: () => [xMin - xPadding, xMax + xPadding] },
        y: { range: () => [yMin - yPadding, yMax + yPadding] },
      },
      series: [
        {},
        {
          label: seriesLabel,
          stroke: "black", // explicit so it can’t be “invisible”
          width: 2,
        },
      ],
    };

    const plot = new uPlot(opts, [xs, ys], hostRef.current);
    plotRef.current = plot;

    return () => {
      plot.destroy();
      plotRef.current = null;
    };
  }, [
    prepared,
    width,
    height,
    xLabel,
    yLabel,
    seriesLabel,
    showLegend,
    xPadding,
    yPadding,
  ]);

  // Update data without recreating chart (optional, but nice if points change often)
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    plot.setData([prepared.xs, prepared.ys], false);
  }, [prepared.xs, prepared.ys]);

  // If everything got filtered out, this will make it obvious in devtools
  // (you can remove later)

  return <div ref={hostRef} />;
}
