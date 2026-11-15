import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import MdIcon from "../md3/MdIcon";
import { PreferencesStore } from "../../storage/preferencesStore";
import {
  formatBG,
  formatDose,
  getGlucoseTone,
  toneColor,
  type GlucoseRange,
} from "./glucoseFormat";
import { interpolateAt, type GlucosePoint } from "./useGlucoseForecast";
import {
  eventIcon,
  eventKindPlural,
  markerLabel,
  type HubEvent,
} from "./hubEvents";

// Vertical layout (px). The plot takes whatever height is left.
const TOP = 24;
const LANE_GAP = 8;
const ROW_H = 31;
const LANE_ROWS = 3;
const IOB_GAP = 6;
const IOB_H = 40;
const AXIS_H = 22;
const MIN_PLOT_H = 120;
// Horizontal layout (px)
const PAD_L = 12;
const GUTTER = 36;

// Interaction
const MIN_SPAN_MS = 20 * 60 * 1000;
const LONG_PRESS_MS = 350;
const SLOP_PX = 6;
const MOMENTUM_DECAY_PER_FRAME = 0.94;
const MOMENTUM_MIN_PX_PER_MS = 0.02;

const TICK_STEPS_MIN = [15, 30, 60, 120, 180, 360, 720];
const MIN_TICK_PX = 64;

export interface ScrubPoint {
  time: number;
  value: number;
  source: "cgm" | "calibration" | "predicted";
}

interface View {
  span: number;
  /** Right edge (ms); null = follow the live edge (now + horizon). */
  end: number | null;
}

interface Props {
  history: GlucosePoint[];
  forecast: GlucosePoint[];
  anchorTime: number | null;
  nowMs: number;
  horizonMs: number;
  earliestMs: number;
  stepMs: number;
  range: GlucoseRange;
  decimal: boolean;
  events: HubEvent[];
  iobSamples: GlucosePoint[];
  iobNow: number;
  scrub: ScrubPoint | null;
  onScrub: (timeMs: number | null) => void;
  onEventTap: (event: HubEvent) => void;
  onGroupTap: (events: HubEvent[]) => void;
  onIOBTap: () => void;
}

type Gesture =
  | { mode: "idle" }
  | {
      mode: "pending" | "pan";
      id: number;
      x0: number;
      y0: number;
      end0: number;
      span0: number;
      lastX: number;
      lastT: number;
      velocity: number;
      isMouse: boolean;
    }
  | { mode: "scrub"; id: number }
  | {
      mode: "pinch";
      d0: number;
      span0: number;
      centerTime0: number;
      pinned: boolean;
    };

let measureCtx: CanvasRenderingContext2D | null = null;
/** Pill width: measured label text + icon (14) + gap (3) + padding (16). */
function pillWidth(label: string) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return Math.ceil(label.length * 7.5 + 40);
  // Set every time: the web font may have loaded since the last call.
  measureCtx.font = `700 11.5px ${getComputedStyle(document.body).fontFamily}`;
  return Math.ceil(measureCtx.measureText(label).width + 14 + 3 + 16 + 6);
}
/** Long meal names are cut with an ellipsis past this width. */
const MAX_PILL_W = 140;
const COMPACT_PILL_W = 30;

interface PlacedMarker {
  events: HubEvent[];
  left: number;
  width: number;
  row: number;
  compact: boolean;
}

function linePath(
  points: GlucosePoint[],
  x: (t: number) => number,
  y: (v: number) => number,
  maxGapMs = Infinity,
) {
  let d = "";
  let prev: GlucosePoint | null = null;
  for (const p of points) {
    const cmd = !prev || p.time - prev.time > maxGapMs ? "M" : "L";
    d += `${cmd}${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`;
    prev = p;
  }
  return d;
}

function axisTimeLabel(t: number, stepMin: number) {
  const d = new Date(t);
  if (d.getHours() === 0 && d.getMinutes() === 0)
    return d.toLocaleDateString([], { weekday: "short" });
  if (d.getMinutes() === 0 || stepMin >= 60)
    return d.toLocaleTimeString([], { hour: "numeric" });
  return `${d.getHours() % 12 || 12}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function niceYStep(span: number, plotH: number) {
  const target = span / Math.max(3, Math.floor(plotH / 55));
  return [10, 20, 25, 50, 100].find((s) => s >= target) ?? 100;
}

/** Eases a numeric pair toward its target so axis rescales don't jump. */
function useEased(target: [number, number]): [number, number] {
  const [value, setValue] = useState(target);
  const ref = useRef(target);
  const [t0, t1] = target;
  useEffect(() => {
    const from = ref.current;
    if (from[0] === t0 && from[1] === t1) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 260);
      const e = 1 - Math.pow(1 - k, 3);
      const v: [number, number] = [
        from[0] + (t0 - from[0]) * e,
        from[1] + (t1 - from[1]) * e,
      ];
      ref.current = v;
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [t0, t1]);
  return value;
}

const HINT_KEY = "synthiq.hubGraphHintSeen";
function readHintSeen() {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export default function GlucoseGraph({
  history,
  forecast,
  anchorTime,
  nowMs,
  horizonMs,
  earliestMs,
  stepMs,
  range,
  decimal,
  events,
  iobSamples,
  iobNow,
  scrub,
  onScrub,
  onEventTap,
  onGroupTap,
  onIOBTap,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hintSeen, setHintSeen] = useState(readHintSeen);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ----- Viewport -------------------------------------------------------
  const liveEdge = nowMs + horizonMs;
  const maxSpan = Math.max(MIN_SPAN_MS, liveEdge - earliestMs);
  const bounds = useRef({ liveEdge, earliestMs, maxSpan });
  bounds.current = { liveEdge, earliestMs, maxSpan };

  const clampView = useCallback((v: View): View => {
    const { liveEdge, earliestMs, maxSpan } = bounds.current;
    const span = Math.min(maxSpan, Math.max(MIN_SPAN_MS, v.span));
    if (v.end === null) return { span, end: null };
    const end = Math.max(earliestMs + span, v.end);
    // Within a hair of the live edge counts as following it.
    if (end >= liveEdge - span * 0.002) return { span, end: null };
    return { span, end };
  }, []);

  const [rawView, setRawView] = useState<View>(() => ({
    span: (PreferencesStore.hubSpanMinutes.value || 240) * 60000,
    end: null,
  }));
  const view = clampView(rawView);
  const viewRef = useRef(view);
  viewRef.current = view;

  const endMs = view.end ?? liveEdge;
  const startMs = endMs - view.span;

  const innerRight = Math.max(0, size.width - GUTTER);
  const innerW = Math.max(1, innerRight - PAD_L);
  const geom = useRef({ innerW });
  geom.current = { innerW };

  const x = (t: number) => PAD_L + ((t - startMs) / view.span) * innerW;
  const timeAtX = (px: number, v: View = viewRef.current) => {
    const end = v.end ?? bounds.current.liveEdge;
    return end - v.span + ((px - PAD_L) / geom.current.innerW) * v.span;
  };

  const commit = useCallback(
    (v: View) => {
      const next = clampView(v);
      viewRef.current = next;
      setRawView(next);
    },
    [clampView],
  );

  const persistSpan = useCallback(() => {
    PreferencesStore.hubSpanMinutes.value = Math.round(
      viewRef.current.span / 60000,
    );
  }, []);

  const markHintSeen = useCallback(() => {
    if (hintSeen) return;
    setHintSeen(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  }, [hintSeen]);

  // ----- Animations (momentum, return to now) ----------------------------
  const animRef = useRef<number | null>(null);
  const stopAnim = () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  };
  useEffect(() => stopAnim, []);

  const startMomentum = (pxPerMs: number) => {
    stopAnim();
    let velocity = pxPerMs;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.max(1, t - last);
      last = t;
      const cur = viewRef.current;
      const curEnd = cur.end ?? bounds.current.liveEdge;
      const msPerPx = cur.span / geom.current.innerW;
      const next = clampView({
        span: cur.span,
        end: curEnd - velocity * dt * msPerPx,
      });
      commit(next);
      velocity *= Math.pow(MOMENTUM_DECAY_PER_FRAME, dt / 16);
      const stalled =
        next.end === cur.end ||
        (next.end === null && cur.end === null) ||
        Math.abs(velocity) < MOMENTUM_MIN_PX_PER_MS;
      animRef.current = stalled ? null : requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const goLive = () => {
    stopAnim();
    const from = viewRef.current.end ?? bounds.current.liveEdge;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 280);
      const e = 1 - Math.pow(1 - k, 3);
      const target = bounds.current.liveEdge;
      commit({
        span: viewRef.current.span,
        end: k < 1 ? from + (target - from) * e : null,
      });
      animRef.current = k < 1 ? requestAnimationFrame(tick) : null;
    };
    animRef.current = requestAnimationFrame(tick);
  };

  // ----- Gestures ------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ mode: "idle" });
  const longPressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current !== null)
      window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const startPinch = () => {
    const [a, b] = Array.from(pointers.current.values());
    const cur = viewRef.current;
    const cx = (a.x + b.x) / 2;
    gesture.current = {
      mode: "pinch",
      d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
      span0: cur.span,
      centerTime0: timeAtX(cx, cur),
      // While following live, zoom keeps "now" pinned in place.
      pinned: cur.end === null,
    };
    onScrub(null);
  };

  const startPan = (
    id: number,
    p: { x: number; y: number },
    isMouse: boolean,
  ) => {
    const cur = viewRef.current;
    gesture.current = {
      mode: "pending",
      id,
      x0: p.x,
      y0: p.y,
      end0: cur.end ?? bounds.current.liveEdge,
      span0: cur.span,
      lastX: p.x,
      lastT: performance.now(),
      velocity: 0,
      isMouse,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopAnim();
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    suppressClick.current = false;

    if (pointers.current.size === 2) {
      clearLongPress();
      suppressClick.current = true;
      containerRef.current?.setPointerCapture?.(e.pointerId);
      startPinch();
      return;
    }
    if (pointers.current.size > 2) return;

    startPan(e.pointerId, p, e.pointerType === "mouse");
    if (e.pointerType !== "mouse") {
      clearLongPress();
      longPressTimer.current = window.setTimeout(() => {
        const g = gesture.current;
        if (g.mode !== "pending") return;
        gesture.current = { mode: "scrub", id: g.id };
        suppressClick.current = true;
        containerRef.current?.setPointerCapture?.(g.id);
        navigator.vibrate?.(8);
        onScrub(timeAtX(g.lastX));
        markHintSeen();
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = localPoint(e);
    const g = gesture.current;

    // Mouse hover inspects.
    if (e.pointerType === "mouse" && !pointers.current.has(e.pointerId)) {
      onScrub(p.y < size.height - AXIS_H ? timeAtX(p.x) : null);
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, p);

    if (g.mode === "pinch") {
      const [a, b] = Array.from(pointers.current.values());
      if (!a || !b) return;
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      const span = g.span0 * (g.d0 / d);
      if (g.pinned) {
        commit({ span, end: null });
      } else {
        const cx = (a.x + b.x) / 2;
        const clampedSpan = Math.min(
          bounds.current.maxSpan,
          Math.max(MIN_SPAN_MS, span),
        );
        const start =
          g.centerTime0 - ((cx - PAD_L) / geom.current.innerW) * clampedSpan;
        commit({ span: clampedSpan, end: start + clampedSpan });
      }
      return;
    }
    if (g.mode === "scrub") {
      if (e.pointerId === g.id) onScrub(timeAtX(p.x));
      return;
    }
    if ((g.mode === "pending" || g.mode === "pan") && e.pointerId === g.id) {
      if (g.mode === "pending") {
        if (Math.hypot(p.x - g.x0, p.y - g.y0) < SLOP_PX) return;
        clearLongPress();
        g.mode = "pan";
        suppressClick.current = true;
        containerRef.current?.setPointerCapture?.(e.pointerId);
        onScrub(null);
        markHintSeen();
      }
      const now = performance.now();
      const dt = Math.max(1, now - g.lastT);
      g.velocity = 0.8 * ((p.x - g.lastX) / dt) + 0.2 * g.velocity;
      g.lastX = p.x;
      g.lastT = now;
      const msPerPx = g.span0 / geom.current.innerW;
      commit({ span: g.span0, end: g.end0 - (p.x - g.x0) * msPerPx });
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) {
      if (e.pointerType === "mouse" && e.type === "pointerleave") onScrub(null);
      return;
    }
    pointers.current.delete(e.pointerId);
    clearLongPress();
    // The click synthesized from this pointer-up fires synchronously; after
    // it, stop suppressing so later taps (incl. keyboard) aren't swallowed.
    if (suppressClick.current && pointers.current.size === 0)
      window.setTimeout(() => (suppressClick.current = false), 0);
    const g = gesture.current;

    if (g.mode === "pinch") {
      persistSpan();
      const remaining = Array.from(pointers.current.entries())[0];
      if (remaining) {
        startPan(remaining[0], remaining[1], false);
        const next = gesture.current;
        if (next.mode === "pending") next.mode = "pan";
      } else {
        gesture.current = { mode: "idle" };
      }
      return;
    }
    if (g.mode === "scrub") {
      onScrub(null);
    } else if (g.mode === "pan") {
      const recent = performance.now() - g.lastT < 80;
      if (recent && Math.abs(g.velocity) > 0.05) startMomentum(g.velocity);
    }
    gesture.current = { mode: "idle" };
    if (e.pointerType === "mouse" && e.type === "pointerleave") onScrub(null);
  };

  // Wheel / trackpad: vertical = zoom at cursor, horizontal = pan.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let persistTimer = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopAnim();
      const cur = viewRef.current;
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
      if (horizontal) {
        const delta = e.deltaX || e.deltaY;
        const msPerPx = cur.span / geom.current.innerW;
        commit({
          span: cur.span,
          end: (cur.end ?? bounds.current.liveEdge) + delta * msPerPx,
        });
      } else {
        const span =
          cur.span * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        if (cur.end === null) {
          commit({ span, end: null });
        } else {
          const anchor = timeAtX(px, cur);
          const frac = (px - PAD_L) / geom.current.innerW;
          const clampedSpan = Math.min(
            bounds.current.maxSpan,
            Math.max(MIN_SPAN_MS, span),
          );
          const start = anchor - frac * clampedSpan;
          commit({ span: clampedSpan, end: start + clampedSpan });
        }
      }
      markHintSeen();
      window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(persistSpan, 400);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(persistTimer);
    };
  }, [commit, persistSpan, markHintSeen]);

  // Persist span after a pinch ends with no fingers left.
  useEffect(() => {
    const id = window.setTimeout(persistSpan, 600);
    return () => window.clearTimeout(id);
  }, [view.span, persistSpan]);

  // ----- Layout --------------------------------------------------------
  const height = size.height;
  const fixedBelow = LANE_GAP + LANE_ROWS * ROW_H + IOB_GAP + IOB_H + AXIS_H;
  const plotH = Math.max(MIN_PLOT_H, height - TOP - fixedBelow);
  const plotBottom = TOP + plotH;
  const laneTop = plotBottom + LANE_GAP;
  const iobTop = laneTop + LANE_ROWS * ROW_H + IOB_GAP;
  const iobBottom = iobTop + IOB_H;

  const visibleHistory = useMemo(
    () =>
      history.filter(
        (p) => p.time >= startMs - stepMs * 2 && p.time <= endMs + stepMs,
      ),
    [history, startMs, endMs, stepMs],
  );
  const visibleForecast = useMemo(
    () => forecast.filter((p) => p.time >= startMs - stepMs * 2),
    [forecast, startMs, stepMs],
  );

  // Y domain from visible data, quantized so it only changes occasionally.
  let lo = range.lowBG;
  let hi = range.highBG;
  for (const p of visibleHistory) {
    if (p.time < startMs || p.time > endMs) continue;
    lo = Math.min(lo, p.value);
    hi = Math.max(hi, p.value);
  }
  for (const p of visibleForecast) {
    if (p.time < startMs || p.time > endMs) continue;
    lo = Math.min(lo, p.value);
    hi = Math.max(hi, p.value);
  }
  const [yMin, yMax] = useEased([
    Math.max(30, Math.floor((lo - 10) / 20) * 20),
    Math.min(450, Math.ceil((hi + 20) / 50) * 50),
  ]);
  const y = (v: number) => TOP + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const yStep = niceYStep(yMax - yMin, plotH);
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep)
    yTicks.push(v);

  // X ticks: smallest clock step that leaves room for a label.
  const pxPerMin = innerW / (view.span / 60000);
  const tickStepMin =
    TICK_STEPS_MIN.find((m) => m * pxPerMin >= MIN_TICK_PX) ??
    TICK_STEPS_MIN[TICK_STEPS_MIN.length - 1];
  const tickMs = tickStepMin * 60000;
  const tzOffsetMs = new Date(startMs).getTimezoneOffset() * 60000;
  const xTicks: number[] = [];
  for (
    let t = Math.ceil((startMs - tzOffsetMs) / tickMs) * tickMs + tzOffsetMs;
    t <= endMs;
    t += tickMs
  )
    xTicks.push(t);

  /** Glucose curve value at t: CGM line up to the anchor, forecast after. */
  const curveAt = (t: number) =>
    anchorTime !== null && t > anchorTime
      ? interpolateAt(forecast, t)
      : interpolateAt(history, t);

  // Markers. Same-kind events whose pills would overlap merge into one
  // marker carrying their total. Each marker then takes a lane row as a
  // labelled pill, else as an icon; only when neither fits do different
  // kinds share a marker.
  const placed = useMemo<PlacedMarker[]>(() => {
    const xs = (t: number) => PAD_L + ((t - startMs) / view.span) * innerW;
    const visible = events.filter(
      (e) => (e.end ?? e.time) >= startMs && e.time <= endMs,
    );

    const clusters: { events: HubEvent[]; x: number; lastX: number }[] = [];
    const openByKind = new Map<string, (typeof clusters)[number]>();
    for (const ev of visible) {
      const ex = xs(Math.max(ev.time, startMs));
      if (ev.end !== undefined) {
        clusters.push({ events: [ev], x: ex, lastX: ex });
        continue;
      }
      const open = openByKind.get(ev.kind);
      if (open) {
        const w = Math.min(
          MAX_PILL_W,
          pillWidth(markerLabel([...open.events, ev])),
        );
        if (ex - open.lastX < w + 3) {
          open.events.push(ev);
          open.lastX = ex;
          open.x =
            open.events.reduce((sum, e) => sum + xs(e.time), 0) /
            open.events.length;
          continue;
        }
      }
      const cluster = { events: [ev], x: ex, lastX: ex };
      clusters.push(cluster);
      openByKind.set(ev.kind, cluster);
    }
    clusters.sort((a, b) => a.x - b.x);

    // Each lane row holds the [left, right] spans already taken.
    const rows: [number, number][][] = [];
    const result: PlacedMarker[] = [];
    const free = (row: number, l: number, r: number) =>
      (rows[row] ?? []).every(([a, b]) => r + 3 <= a || l >= b + 3);
    const tryRow = (l: number, w: number) => {
      for (let row = 0; row < LANE_ROWS; row++)
        if (free(row, l, l + w)) return row;
      return -1;
    };
    const take = (row: number, l: number, w: number, isMeal = false) => {
      (rows[row] ??= []).push([l, l + w]);
      (rowsMeal[row] ??= []).push(isMeal);
    };
    // Row where [l, l + w] overlaps the least; meal pills count as fully
    // blocking so nothing is ever drawn underneath a meal name.
    const rowsMeal: boolean[][] = [];
    const leastOverlapRow = (l: number, w: number) => {
      let best = 0;
      let bestCost = Infinity;
      for (let row = 0; row < LANE_ROWS; row++) {
        let cost = 0;
        (rows[row] ?? []).forEach(([a, b], k) => {
          const overlap = Math.max(0, Math.min(b, l + w) - Math.max(a, l));
          cost += overlap > 0 && rowsMeal[row]?.[k] ? 1e6 : overlap;
        });
        if (cost < bestCost) {
          bestCost = cost;
          best = row;
        }
      }
      return best;
    };
    const fit = (center: number, w: number) =>
      Math.min(Math.max(0, center - w / 2), Math.max(0, innerRight - w));

    // Activities, then meals, claim lane space first so their names show;
    // the rest fill in around them.
    const priority = (c: (typeof clusters)[number]) =>
      c.events[0].end !== undefined ? 0 : c.events[0].kind === "meal" ? 1 : 2;
    const order = [...clusters].sort(
      (a, b) => priority(a) - priority(b) || a.x - b.x,
    );

    for (const c of order) {
      const first = c.events[0];
      if (first.end !== undefined) {
        const w = Math.max(
          pillWidth(first.label),
          xs(Math.min(first.end, endMs)) - c.x,
        );
        const left = Math.min(Math.max(0, c.x), Math.max(0, innerRight - w));
        let row = tryRow(left, w);
        if (row === -1) row = leastOverlapRow(left, w);
        take(row, left, w);
        result.push({ events: c.events, left, width: w, row, compact: false });
        continue;
      }

      let width = Math.min(MAX_PILL_W, pillWidth(markerLabel(c.events)));
      let compact = false;
      let left = fit(c.x, width);
      let row = tryRow(left, width);
      if (row === -1) {
        width = COMPACT_PILL_W;
        compact = true;
        left = fit(c.x, width);
        row = tryRow(left, width);
      }
      if (row === -1) {
        // Lane full here: stack onto a nearby marker of the same kind, else
        // sit as an icon in the least busy row (meal pills render on top,
        // so their names stay readable).
        const center = (m: PlacedMarker) => m.left + m.width / 2;
        let host: PlacedMarker | null = null;
        for (const m of result) {
          if (m.events[0].end !== undefined || m.events[0].kind !== first.kind)
            continue;
          const d = Math.abs(center(m) - c.x);
          if (d <= m.width && (!host || d < Math.abs(center(host) - c.x)))
            host = m;
        }
        if (host) {
          host.events.push(...c.events);
          host.events.sort((a, b) => a.time - b.time);
          continue;
        }
        row = leastOverlapRow(left, width);
      }
      take(row, left, width, first.kind === "meal" && !compact);
      result.push({ events: c.events, left, width, row, compact });
    }
    return result;
  }, [events, startMs, endMs, view.span, innerW, innerRight]);

  const iobMax = useMemo(
    () => Math.max(0.5, ...iobSamples.map((s) => s.value)),
    [iobSamples],
  );
  const visibleIOB = iobSamples.filter(
    (s) => s.time >= startMs - stepMs * 2 && s.time <= endMs + stepMs * 2,
  );
  const iobY = (v: number) => iobBottom - (v / iobMax) * (IOB_H - 6);
  const iobPath =
    visibleIOB.length > 1
      ? `${linePath(visibleIOB, x, iobY)}L${x(visibleIOB[visibleIOB.length - 1].time)},${iobBottom}L${x(visibleIOB[0].time)},${iobBottom}Z`
      : "";

  const ready = size.width > 0 && size.height > 0;
  const xNow = x(nowMs);
  const nowVisible = xNow >= 0 && xNow <= innerRight;
  const pxPerStep = (stepMs / 60000) * pxPerMin;
  const showDots = pxPerStep >= 4;
  const dotR = Math.min(3, Math.max(1.8, pxPerStep * 0.28));
  const historyGap = stepMs * 3;

  const inWindowForecast = visibleForecast.filter((p) => p.time <= endMs + 1);
  const lastForecast =
    view.end === null && inWindowForecast.length > 0
      ? inWindowForecast[inWindowForecast.length - 1]
      : null;
  const prevForecast =
    inWindowForecast.length > 1
      ? inWindowForecast[inWindowForecast.length - 2]
      : null;
  const forecastFalling =
    lastForecast !== null &&
    prevForecast !== null &&
    lastForecast.value < prevForecast.value;

  const rangeLabels = [
    { v: range.lowBG, color: toneColor.low },
    { v: range.highBG, color: toneColor.high },
  ];
  const tickLabels = yTicks.filter((v) =>
    rangeLabels.every((r) => Math.abs(y(v) - y(r.v)) > 13),
  );

  return (
    <div
      ref={containerRef}
      className="hub-graph"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.stopPropagation();
          e.preventDefault();
          suppressClick.current = false;
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {ready && (
        <>
          <svg
            width={size.width}
            height={height}
            className="hub-graph-svg"
            role="img"
            aria-label="Glucose history and forecast. Drag to scroll, pinch to zoom, press and hold to inspect."
          >
            <defs>
              <clipPath id="hub-plot-clip">
                <rect
                  x={0}
                  y={TOP - 8}
                  width={innerRight}
                  height={plotH + 16}
                />
              </clipPath>
              <clipPath id="hub-x-clip">
                <rect x={0} y={0} width={innerRight} height={height} />
              </clipPath>
              <clipPath id="hub-iob-past">
                <rect
                  x={0}
                  y={iobTop}
                  width={Math.min(innerRight, Math.max(0, xNow))}
                  height={IOB_H}
                />
              </clipPath>
              <clipPath id="hub-iob-future">
                <rect
                  x={Math.max(0, xNow)}
                  y={iobTop}
                  width={Math.max(0, innerRight - Math.max(0, xNow))}
                  height={IOB_H}
                />
              </clipPath>
            </defs>

            {/* Forecast region */}
            {xNow < innerRight && (
              <rect
                x={Math.max(0, xNow)}
                y={TOP}
                width={innerRight - Math.max(0, xNow)}
                height={plotH}
                className="hub-future-region"
              />
            )}

            {/* Target band + range lines */}
            <rect
              x={0}
              y={y(range.highBG)}
              width={innerRight}
              height={Math.max(0, y(range.lowBG) - y(range.highBG))}
              fill="var(--app-status-target)"
              fillOpacity={0.08}
            />
            <line
              x1={0}
              x2={innerRight}
              y1={y(range.highBG)}
              y2={y(range.highBG)}
              stroke={toneColor.high}
              strokeOpacity={0.45}
              strokeDasharray="4 4"
            />
            <line
              x1={0}
              x2={innerRight}
              y1={y(range.lowBG)}
              y2={y(range.lowBG)}
              stroke={toneColor.low}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
            />

            {/* Grid */}
            {tickLabels.map((v) => (
              <line
                key={`gy-${v}`}
                x1={0}
                x2={innerRight}
                y1={y(v)}
                y2={y(v)}
                className="hub-grid"
              />
            ))}
            <g clipPath="url(#hub-x-clip)">
              {xTicks.map((t) => (
                <line
                  key={`gx-${t}`}
                  x1={x(t)}
                  x2={x(t)}
                  y1={TOP}
                  y2={iobBottom}
                  className={`hub-grid ${new Date(t).getHours() === 0 && new Date(t).getMinutes() === 0 ? "hub-grid-day" : ""}`}
                />
              ))}
            </g>

            {/* Y labels (right gutter) */}
            {tickLabels.map((v) => (
              <text
                key={`ly-${v}`}
                x={size.width - 4}
                y={y(v) + 3.5}
                textAnchor="end"
                className="hub-axis-label"
              >
                {v}
              </text>
            ))}
            {rangeLabels.map((r) => (
              <text
                key={`lr-${r.v}`}
                x={size.width - 4}
                y={y(r.v) + 3.5}
                textAnchor="end"
                className="hub-axis-label hub-axis-label-strong"
                fill={r.color}
              >
                {r.v}
              </text>
            ))}

            <g clipPath="url(#hub-x-clip)">
              {/* Activity spans */}
              {placed
                .filter((m) => m.events[0].end !== undefined)
                .map((m) => (
                  <rect
                    key={`span-${m.events[0].id}`}
                    x={x(m.events[0].time)}
                    y={TOP}
                    width={Math.max(
                      0,
                      x(m.events[0].end!) - x(m.events[0].time),
                    )}
                    height={plotH}
                    className="hub-activity-span"
                  />
                ))}
            </g>

            <g clipPath="url(#hub-plot-clip)">
              {/* Event guides: from the lane up to the curve */}
              {placed.flatMap((m) =>
                m.events
                  .filter((ev) => ev.end === undefined)
                  .map((ev) => {
                    const ex = x(ev.time);
                    const v = curveAt(ev.time);
                    const cy = v !== null ? y(v) : TOP;
                    return (
                      <g key={`guide-${ev.id}`}>
                        <line
                          x1={ex}
                          x2={ex}
                          y1={cy}
                          y2={laneTop + m.row * ROW_H}
                          className={`hub-event-guide hub-kind-${ev.kind}`}
                        />
                        {v !== null && (
                          <circle
                            cx={ex}
                            cy={cy}
                            r={4}
                            className={`hub-event-dot hub-kind-${ev.kind}`}
                          />
                        )}
                      </g>
                    );
                  }),
              )}

              {/* CGM history */}
              <path
                d={linePath(visibleHistory, x, y, historyGap)}
                className={`hub-history-line ${showDots ? "" : "is-solo"}`}
              />
              {visibleHistory.map((p) =>
                p.isCalibration ? (
                  <polygon
                    key={`h-${p.time}`}
                    points={`${x(p.time)},${y(p.value) - 5} ${x(p.time) + 5},${y(p.value)} ${x(p.time)},${y(p.value) + 5} ${x(p.time) - 5},${y(p.value)}`}
                    className="hub-calibration-dot"
                  />
                ) : showDots || p.time === anchorTime ? (
                  <circle
                    key={`h-${p.time}`}
                    cx={x(p.time)}
                    cy={y(p.value)}
                    r={p.time === anchorTime ? dotR + 1.6 : dotR}
                    fill={toneColor[getGlucoseTone(p.value, range)]}
                    className="hub-history-dot"
                  />
                ) : null,
              )}

              {/* Forecast */}
              <path
                d={linePath(visibleForecast, x, y)}
                className="hub-forecast-line"
              />
            </g>

            {lastForecast && (
              <g>
                <circle
                  cx={x(lastForecast.time)}
                  cy={y(lastForecast.value)}
                  r={3.5}
                  className="hub-forecast-end"
                />
                <text
                  x={x(lastForecast.time) - 6}
                  y={y(lastForecast.value) + (forecastFalling ? 18 : -9)}
                  textAnchor="end"
                  className="hub-forecast-label"
                >
                  {formatBG(lastForecast.value, decimal)}
                </text>
              </g>
            )}

            {/* Now marker */}
            {nowVisible && (
              <>
                <line
                  x1={xNow}
                  x2={xNow}
                  y1={TOP - 4}
                  y2={iobBottom}
                  className="hub-now-line"
                />
                <text
                  x={xNow}
                  y={TOP - 9}
                  textAnchor="middle"
                  className="hub-now-label"
                >
                  Now
                </text>
              </>
            )}

            {/* IOB strip */}
            {iobPath && (
              <>
                <path
                  d={iobPath}
                  className="hub-iob-area"
                  clipPath="url(#hub-iob-past)"
                />
                <path
                  d={iobPath}
                  className="hub-iob-area hub-iob-area-future"
                  clipPath="url(#hub-iob-future)"
                />
              </>
            )}
            <line
              x1={0}
              x2={innerRight}
              y1={iobBottom}
              y2={iobBottom}
              className="hub-baseline"
            />
            <text
              x={size.width - 4}
              y={iobBottom - 20}
              textAnchor="end"
              className="hub-iob-tag"
            >
              IOB
            </text>
            <text
              x={size.width - 4}
              y={iobBottom - 6}
              textAnchor="end"
              className="hub-axis-label hub-axis-label-strong"
            >
              {formatDose(iobNow)}u
            </text>

            {/* Time axis */}
            {xTicks.map((t) =>
              x(t) >= 16 && x(t) <= innerRight - 16 ? (
                <text
                  key={`lx-${t}`}
                  x={x(t)}
                  y={iobBottom + 15}
                  textAnchor="middle"
                  className={`hub-axis-label ${new Date(t).getHours() === 0 && new Date(t).getMinutes() === 0 ? "hub-axis-label-strong" : ""}`}
                >
                  {axisTimeLabel(t, tickStepMin)}
                </text>
              ) : null,
            )}

            {/* Scrub crosshair */}
            {scrub && (
              <g pointerEvents="none">
                <line
                  x1={x(scrub.time)}
                  x2={x(scrub.time)}
                  y1={TOP}
                  y2={iobBottom}
                  className="hub-scrub-line"
                />
                <circle
                  cx={x(scrub.time)}
                  cy={y(scrub.value)}
                  r={6}
                  fill={toneColor[getGlucoseTone(scrub.value, range)]}
                  className="hub-scrub-dot"
                />
              </g>
            )}
          </svg>

          {/* IOB tap target */}
          <button
            type="button"
            className="hub-iob-hit"
            style={{ top: iobTop, height: IOB_H }}
            onClick={onIOBTap}
            aria-label={`Insulin on board ${formatDose(iobNow)} units. Show details`}
          />

          {/* Event markers (HTML for real tap targets) */}
          {placed.map((m) => {
            const first = m.events[0];
            const multi = m.events.length > 1;
            const total = markerLabel(m.events);
            return (
              <button
                key={first.id}
                type="button"
                className={`hub-event-pill hub-kind-${first.kind} ${m.compact ? "is-compact" : ""} ${multi ? "is-stacked" : ""} ${m.events.length > 2 ? "is-stacked-deep" : ""}`}
                style={{
                  left: m.left,
                  top: laneTop + m.row * ROW_H + 2,
                  width: m.width,
                }}
                onClick={() =>
                  multi ? onGroupTap(m.events) : onEventTap(first)
                }
                aria-label={
                  multi
                    ? `${m.events.length} ${eventKindPlural[first.kind]}, ${total}, show list`
                    : `${first.title}, show details`
                }
              >
                <MdIcon name={eventIcon[first.kind]} size={14} fill />
                {!m.compact && <span>{total}</span>}
              </button>
            );
          })}

          {view.end !== null && (
            <button
              type="button"
              className="hub-now-chip"
              style={{ top: TOP + 4, right: GUTTER + 8 }}
              onClick={goLive}
            >
              Now
              <MdIcon name="arrow_forward" size={16} />
            </button>
          )}

          {!hintSeen && (
            <div
              className="hub-graph-hint"
              style={{ top: TOP + 4, left: PAD_L + 6 }}
            >
              Drag · pinch to zoom · hold to inspect
            </div>
          )}
        </>
      )}
    </div>
  );
}
