import { useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

export type XYPoint = { x: number; y: number };

export type Marker =
  | {
      kind: "line";
      x: number; // hours since start
      label?: string;
      // optional vertical placement for label in pixels (default: top)
      labelOffsetPx?: number; // e.g. 12
      color?: string;
      thickness?: number; // px
    }
  | {
      kind: "point";
      x: number; // hours since start
      y: number; // mg/dL (or whatever your y scale is)
      label?: string;
      color?: string;
      thickness?: number; // px
      rPx?: number; // point radius (default 4)
      labelOffsetPx?: number; // default 10
    };

export type GraphProps = {
  points: XYPoint[];
  markers?: Marker[];

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

/** uPlot plugin that draws vertical event lines + labeled points */
function markersPlugin(getMarkers: () => Marker[] | undefined): uPlot.Plugin {
  return {
    hooks: {
      draw: [
        (u) => {
          const markers = getMarkers();
          if (!markers || markers.length === 0) return;

          const ctx = u.ctx;
          const { left, top, width, height } = u.bbox;

          ctx.save();

          // Clip to plotting area so labels/lines don't scribble outside
          ctx.beginPath();
          ctx.rect(left, top, width, height);
          ctx.clip();

          // Basic styling
          ctx.strokeStyle = "rgba(0,0,0,0.35)";
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.lineWidth = 1;
          ctx.font =
            "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.textBaseline = "top";

          for (const m of markers) {
            const color = m.color ?? "rgba(220,38,38,0.85)"; // default red-ish
            const thickness = m.thickness ?? 2;

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = thickness;

            if (m.kind === "line") {
              const xPos = u.valToPos(m.x, "x", true);
              if (!Number.isFinite(xPos)) continue;

              // vertical line
              ctx.beginPath();
              ctx.moveTo(xPos, top);
              ctx.lineTo(xPos, top + height);
              ctx.stroke();

              if (m.label) {
                const yText = top + (m.labelOffsetPx ?? 6);
                const pad = 2;
                const w = ctx.measureText(m.label).width;

                ctx.fillStyle = "rgba(255,255,255,0.75)";
                ctx.fillRect(xPos + 4, yText, w + pad * 2, 16);

                ctx.fillStyle = color;
                ctx.fillText(m.label, xPos + 4 + pad, yText + 2);
              }
            } else {
              const xPos = u.valToPos(m.x, "x", true);
              const yPos = u.valToPos(m.y, "y", true);
              if (!Number.isFinite(xPos) || !Number.isFinite(yPos)) continue;

              const r = m.rPx ?? 4;

              // point
              ctx.beginPath();
              ctx.arc(xPos, yPos, r, 0, Math.PI * 2);
              ctx.fill();

              if (m.label) {
                const yText = yPos - (m.labelOffsetPx ?? 10);
                const pad = 2;
                const w = ctx.measureText(m.label).width;

                ctx.fillStyle = "rgba(255,255,255,0.75)";
                ctx.fillRect(xPos + 6, yText, w + pad * 2, 16);

                ctx.fillStyle = color;
                ctx.fillText(m.label, xPos + 6 + pad, yText + 2);
              }
            }
          }

          ctx.restore();
        },
      ],
    },
  };
}

export function Graph({
  points,
  markers,
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
    const cleaned = (points ?? [])
      .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);

    const xs = cleaned.map((p) => p.x);
    const ys = cleaned.map((p) => p.y);

    const [xMin, xMax] = extent(xs);
    const [yMin, yMax] = extent(ys);

    return { xs, ys, xMin, xMax, yMin, yMax };
  }, [points]);

  // Keep markers accessible to plugin without re-creating plugin constantly
  const markersRef = useRef<Marker[] | undefined>(markers);
  useEffect(() => {
    markersRef.current = markers;
    // Force redraw when markers change
    plotRef.current?.redraw();
  }, [markers]);

  useEffect(() => {
    if (!hostRef.current) return;

    plotRef.current?.destroy();
    plotRef.current = null;

    const { xs, ys, xMin, xMax, yMin, yMax } = prepared;

    const opts: uPlot.Options = {
      width,
      height,
      plugins: [markersPlugin(() => markersRef.current)],
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
          stroke: "black",
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

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    plot.setData([prepared.xs, prepared.ys], false);
  }, [prepared.xs, prepared.ys]);

  return <div ref={hostRef} />;
}
