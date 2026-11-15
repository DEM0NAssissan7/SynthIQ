import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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

// Label widths are measured once per label and font. Reading computed style
// on every call forces a style recalc, which is very costly mid-gesture on
// WebKit, so the font is read once and re-read only when web fonts load.
let measureCtx: CanvasRenderingContext2D | null = null;
let measureFont: string | null = null;
const widthCache = new Map<string, number>();
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.addEventListener?.("loadingdone", () => {
    measureFont = null;
    widthCache.clear();
  });
}
/** Pill width: measured label text + icon (14) + gap (3) + padding (16). */
function pillWidth(label: string) {
  const cached = widthCache.get(label);
  if (cached !== undefined) return cached;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return Math.ceil(label.length * 7.5 + 40);
  if (measureFont === null) {
    measureFont = `700 11.5px ${getComputedStyle(document.body).fontFamily}`;
  }
  measureCtx.font = measureFont;
  const w = Math.ceil(measureCtx.measureText(label).width + 14 + 3 + 16 + 6);
  widthCache.set(label, w);
  return w;
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

// toLocale*String builds a new Intl formatter per call (slow, especially on
// WebKit); reuse one per format.
const weekdayFormat = new Intl.DateTimeFormat([], { weekday: "short" });
const hourFormat = new Intl.DateTimeFormat([], { hour: "numeric" });

function axisTimeLabel(t: number, stepMin: number) {
  const d = new Date(t);
  if (d.getHours() === 0 && d.getMinutes() === 0)
    return weekdayFormat.format(d);
  if (d.getMinutes() === 0 || stepMin >= 60) return hourFormat.format(d);
  return `${d.getHours() % 12 || 12}:${d.getMinutes().toString().padStart(2, "0")}`;
}

const isMidnight = (t: number) => {
  const d = new Date(t);
  return d.getHours() === 0 && d.getMinutes() === 0;
};

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

/** Theme colors for canvas drawing, resolved from the CSS variables. */
interface GraphPalette {
  primary: string;
  secondary: string;
  tertiary: string;
  bg: string;
  surfaceContainer: string;
  outline: string;
  outlineVariant: string;
  textMuted: string;
  target: string;
  elevated: string;
  low: string;
  tone: Record<"low" | "high" | "target", string>;
  kind: Record<HubEvent["kind"], string>;
  font: string;
}
let paletteCache: GraphPalette | null = null;
function readPalette(el: Element): GraphPalette {
  if (paletteCache) return paletteCache;
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const primary = v("--md-sys-color-primary");
  const secondary = v("--md-sys-color-secondary");
  const tertiary = v("--md-sys-color-tertiary");
  const target = v("--app-status-target");
  const elevated = v("--app-status-elevated");
  const low = v("--app-status-low");
  paletteCache = {
    primary,
    secondary,
    tertiary,
    bg: v("--md-sys-color-surface"),
    surfaceContainer: v("--md-sys-color-surface-container"),
    outline: v("--md-sys-color-outline"),
    outlineVariant: v("--md-sys-color-outline-variant"),
    textMuted: v("--md-sys-color-on-surface-variant"),
    target,
    elevated,
    low,
    tone: { low, high: elevated, target },
    kind: {
      bolus: primary,
      meal: tertiary,
      rescue: elevated,
      basal: target,
      activity: secondary,
    },
    font: cs.fontFamily,
  };
  return paletteCache;
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
    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
      rectRef.current = null;
    };
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

  /** Apply a view now (used inside animation frames). */
  const commit = useCallback(
    (v: View) => {
      const next = clampView(v);
      viewRef.current = next;
      setRawView(next);
    },
    [clampView],
  );

  // Gesture input can arrive faster than the display refreshes (120 Hz
  // touch on iPhone). Moves update viewRef immediately, so the gesture math
  // stays exact, but React renders at most once per frame.
  const frameRef = useRef<number | null>(null);
  const scheduleCommit = useCallback(
    (v: View) => {
      viewRef.current = clampView(v);
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setRawView(viewRef.current);
      });
    },
    [clampView],
  );
  const scrubFrame = useRef<number | null>(null);
  const pendingScrub = useRef<number | null>(null);
  const scheduleScrub = useCallback(
    (t: number | null) => {
      pendingScrub.current = t;
      if (scrubFrame.current !== null) return;
      scrubFrame.current = requestAnimationFrame(() => {
        scrubFrame.current = null;
        onScrub(pendingScrub.current);
      });
    },
    [onScrub],
  );
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (scrubFrame.current !== null) cancelAnimationFrame(scrubFrame.current);
    },
    [],
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

  // Container position, measured when a gesture or hover starts rather than
  // on every move (a rect read right after a render forces layout).
  const rectRef = useRef<{ left: number; top: number } | null>(null);
  const measureRect = () => {
    const r = containerRef.current!.getBoundingClientRect();
    rectRef.current = { left: r.left, top: r.top };
  };
  const localPoint = (e: { clientX: number; clientY: number }) => {
    if (!rectRef.current) measureRect();
    const r = rectRef.current!;
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
    scheduleScrub(null);
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

  /** Route every later event for this pointer to the graph itself. */
  const capture = (pointerId: number) => {
    try {
      containerRef.current?.setPointerCapture(pointerId);
    } catch {
      /* pointer already gone */
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopAnim();
    measureRect();
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    suppressClick.current = false;
    // Touches are captured by the graph immediately. Otherwise the touch
    // stays bound to whatever element was under the finger at touch-down,
    // and iOS stops delivering it once that element moves or is redrawn.
    // Touches that start on a marker/button stay with it so taps work;
    // they are captured once they turn into a drag.
    const onControl =
      e.target instanceof Element && e.target.closest("button") !== null;
    if (e.pointerType !== "mouse" && !onControl) capture(e.pointerId);

    if (pointers.current.size === 2) {
      clearLongPress();
      suppressClick.current = true;
      for (const id of pointers.current.keys()) capture(id);
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
        capture(g.id);
        navigator.vibrate?.(8);
        scheduleScrub(timeAtX(g.lastX));
        markHintSeen();
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = localPoint(e);
    const g = gesture.current;

    // Mouse hover inspects.
    if (e.pointerType === "mouse" && !pointers.current.has(e.pointerId)) {
      scheduleScrub(p.y < size.height - AXIS_H ? timeAtX(p.x) : null);
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
        scheduleCommit({ span, end: null });
      } else {
        const cx = (a.x + b.x) / 2;
        const clampedSpan = Math.min(
          bounds.current.maxSpan,
          Math.max(MIN_SPAN_MS, span),
        );
        const start =
          g.centerTime0 - ((cx - PAD_L) / geom.current.innerW) * clampedSpan;
        scheduleCommit({ span: clampedSpan, end: start + clampedSpan });
      }
      return;
    }
    if (g.mode === "scrub") {
      if (e.pointerId === g.id) scheduleScrub(timeAtX(p.x));
      return;
    }
    if ((g.mode === "pending" || g.mode === "pan") && e.pointerId === g.id) {
      if (g.mode === "pending") {
        if (Math.hypot(p.x - g.x0, p.y - g.y0) < SLOP_PX) return;
        clearLongPress();
        g.mode = "pan";
        suppressClick.current = true;
        capture(e.pointerId);
        scheduleScrub(null);
        markHintSeen();
      }
      const now = performance.now();
      const dt = Math.max(1, now - g.lastT);
      g.velocity = 0.8 * ((p.x - g.lastX) / dt) + 0.2 * g.velocity;
      g.lastX = p.x;
      g.lastT = now;
      const msPerPx = g.span0 / geom.current.innerW;
      scheduleCommit({ span: g.span0, end: g.end0 - (p.x - g.x0) * msPerPx });
    }
  };

  /** pointerup / pointercancel: a finger lifted (or the OS took it back). */
  const onPointerEnd = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const cancelled = e.type === "pointercancel";
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
      scheduleScrub(null);
    } else if (g.mode === "pan" && !cancelled) {
      const recent = performance.now() - g.lastT < 80;
      if (recent && Math.abs(g.velocity) > 0.05) startMomentum(g.velocity);
    }
    gesture.current = { mode: "idle" };
  };

  // Native listeners on the graph element (not React's delegated ones at the
  // app root): with capture, events always arrive here even if the element
  // first touched has since been moved or replaced.
  const gestureHandlers = useRef({
    onPointerDown,
    onPointerMove,
    onPointerEnd,
  });
  gestureHandlers.current = { onPointerDown, onPointerMove, onPointerEnd };
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => gestureHandlers.current.onPointerDown(e);
    const move = (e: PointerEvent) => gestureHandlers.current.onPointerMove(e);
    const end = (e: PointerEvent) => gestureHandlers.current.onPointerEnd(e);
    // Leaving only matters for mouse hover; it never ends a touch gesture.
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !pointers.current.has(e.pointerId))
        scheduleScrub(null);
    };
    const enter = () => measureRect();
    // iOS Safari: keep the browser from claiming the gesture for scrolling or
    // page zoom (which cancels our touches mid-drag). Taps still work since
    // touchstart is left alone.
    const blockTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    const blockGesture = (e: Event) => e.preventDefault();
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("touchmove", blockTouchMove, { passive: false });
    el.addEventListener("gesturestart", blockGesture);
    el.addEventListener("gesturechange", blockGesture);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("touchmove", blockTouchMove);
      el.removeEventListener("gesturestart", blockGesture);
      el.removeEventListener("gesturechange", blockGesture);
    };
  }, [scheduleScrub]);

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
        scheduleCommit({
          span: cur.span,
          end: (cur.end ?? bounds.current.liveEdge) + delta * msPerPx,
        });
      } else {
        const span =
          cur.span * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        if (cur.end === null) {
          scheduleCommit({ span, end: null });
        } else {
          const anchor = timeAtX(px, cur);
          const frac = (px - PAD_L) / geom.current.innerW;
          const clampedSpan = Math.min(
            bounds.current.maxSpan,
            Math.max(MIN_SPAN_MS, span),
          );
          const start = anchor - frac * clampedSpan;
          scheduleCommit({ span: clampedSpan, end: start + clampedSpan });
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
  }, [scheduleCommit, persistSpan, markHintSeen]);

  // Persist span after a pinch ends with no fingers left.
  useEffect(() => {
    const id = window.setTimeout(persistSpan, 600);
    return () => window.clearTimeout(id);
  }, [view.span, persistSpan]);

  // ----- Layout --------------------------------------------------------
  const ready = size.width > 0 && size.height > 0;
  const height = size.height;
  const fixedBelow = LANE_GAP + LANE_ROWS * ROW_H + IOB_GAP + IOB_H + AXIS_H;
  const plotH = Math.max(MIN_PLOT_H, height - TOP - fixedBelow);
  const plotBottom = TOP + plotH;
  const laneTop = plotBottom + LANE_GAP;
  const iobTop = laneTop + LANE_ROWS * ROW_H + IOB_GAP;
  const iobBottom = iobTop + IOB_H;

  // Y domain: from the user's danger low to their high threshold, widened
  // only as far as a visible reading or forecast point goes past either,
  // plus a little headroom so points never sit on the edge.
  const Y_HEADROOM = 5;
  let lo = range.dangerBG;
  let hi = range.highBG;
  for (const p of history) {
    if (p.time < startMs) continue;
    if (p.time > endMs) break;
    lo = Math.min(lo, p.value);
    hi = Math.max(hi, p.value);
  }
  for (const p of forecast) {
    if (p.time < startMs || p.time > endMs) continue;
    lo = Math.min(lo, p.value);
    hi = Math.max(hi, p.value);
  }
  const [yMin, yMax] = useEased([
    Math.round(lo - Y_HEADROOM),
    Math.round(hi + Y_HEADROOM),
  ]);
  const y = (v: number) => TOP + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const yStep = niceYStep(yMax - yMin, plotH);
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep)
    yTicks.push(v);
  const rangeLabels = [
    { v: range.lowBG, color: toneColor.low },
    { v: range.highBG, color: toneColor.high },
  ];
  const tickLabels = yTicks.filter((v) =>
    rangeLabels.every((r) => Math.abs(y(v) - y(r.v)) > 13),
  );

  // ----- Marker layer -----------------------------------------------------
  // Marker pills are real buttons, laid out once in a layer three viewports
  // wide and slid with a composited transform while panning. Their layout is
  // redone only when the zoom changes or the pan runs out of slack.
  const layerRef = useRef<{ start: number; span: number } | null>(null);
  let layer = layerRef.current;
  const slack = layer ? (startMs - layer.start) / view.span : 0;
  if (!layer || layer.span !== view.span || slack < 0.15 || slack > 1.85) {
    layer = { start: startMs - view.span, span: view.span };
    layerRef.current = layer;
  }
  const layerW = innerW * 3;
  const layerDx = PAD_L - ((startMs - layer.start) / layer.span) * innerW;

  // Taps reach the latest handlers without invalidating the laid-out pills.
  const handlers = useRef({ onEventTap, onGroupTap });
  handlers.current = { onEventTap, onGroupTap };

  const layerStart = layer.start;
  const layerSpan = layer.span;
  const placed = useMemo<PlacedMarker[]>(() => {
    if (!ready) return [];
    const lEnd = layerStart + 3 * layerSpan;
    const lx = (t: number) => ((t - layerStart) / layerSpan) * innerW;

    // Markers. Same-kind events whose pills would overlap merge into one
    // marker carrying their total. Each marker then takes a lane row as a
    // labelled pill, else as an icon; if neither fits it stacks onto a
    // nearby same-kind marker or takes the least-overlapping row.
    const visible = events.filter(
      (e) => (e.end ?? e.time) >= layerStart && e.time <= lEnd,
    );
    // firstX bounds a group's spread: an event joins only if it is within one
    // marker width of the group's first event, so merges stay local.
    const clusters: {
      events: HubEvent[];
      x: number;
      firstX: number;
    }[] = [];
    const openByKind = new Map<string, (typeof clusters)[number]>();
    for (const ev of visible) {
      const ex = lx(Math.max(ev.time, layerStart));
      if (ev.end !== undefined) {
        clusters.push({ events: [ev], x: ex, firstX: ex });
        continue;
      }
      const open = openByKind.get(ev.kind);
      if (open) {
        const w = Math.min(
          MAX_PILL_W,
          pillWidth(markerLabel([...open.events, ev])),
        );
        if (ex - open.firstX < w + 3) {
          open.events.push(ev);
          open.x =
            open.events.reduce((sum, e) => sum + lx(e.time), 0) /
            open.events.length;
          continue;
        }
      }
      const cluster = { events: [ev], x: ex, firstX: ex };
      clusters.push(cluster);
      openByKind.set(ev.kind, cluster);
    }

    const rows: [number, number][][] = [];
    const rowsMeal: boolean[][] = [];
    const placed: PlacedMarker[] = [];
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
      Math.min(Math.max(0, center - w / 2), Math.max(0, layerW - w));

    // Activities, then meals, claim lane space first so their names show.
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
          lx(Math.min(first.end, lEnd)) - c.x,
        );
        const left = Math.min(Math.max(0, c.x), Math.max(0, layerW - w));
        let row = tryRow(left, w);
        if (row === -1) row = leastOverlapRow(left, w);
        take(row, left, w);
        placed.push({ events: c.events, left, width: w, row, compact: false });
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
        const center = (m: PlacedMarker) => m.left + m.width / 2;
        let host: PlacedMarker | null = null;
        for (const m of placed) {
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
      placed.push({ events: c.events, left, width, row, compact });
    }

    return placed;
  }, [ready, layerStart, layerSpan, layerW, innerW, events]);

  const pills = useMemo(
    () =>
      placed.map((m) => {
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
              multi
                ? handlers.current.onGroupTap(m.events)
                : handlers.current.onEventTap(first)
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
      }),
    [placed, laneTop],
  );

  // ----- Plot (canvas) -----------------------------------------------------
  // The plot is painted straight onto a canvas after every render. A frame
  // costs a few hundred draw calls and no DOM work, so panning, zooming and
  // axis rescaling all stay at the display's frame rate.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, bumpTheme] = useState(0);
  useEffect(() => {
    // Colors are read from CSS once and re-read when the theme changes.
    const observer = new MutationObserver(() => {
      paletteCache = null;
      bumpTheme((n) => n + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "data-bs-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(innerRight * dpr);
    const ch = Math.round(height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pal = readPalette(canvas);
    const W = innerRight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, height);
    ctx.lineJoin = "round";

    const px = (t: number) => PAD_L + ((t - startMs) / view.span) * innerW;
    const py = (v: number) => TOP + (1 - (v - yMin) / (yMax - yMin)) * plotH;
    const margin = stepMs * 2;
    const inView = (p: { time: number }) =>
      p.time >= startMs - margin && p.time <= endMs + margin;
    const vHistory = history.filter(inView);
    const vForecast = forecast.filter(inView);
    const vIOB = iobSamples.filter(inView);
    const xNow = px(nowMs);

    const hline = (
      yy: number,
      color: string,
      alpha: number,
      dash: number[] = [],
      x0 = 0,
      x1 = W,
    ) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x1, yy);
      ctx.stroke();
    };
    const vline = (
      xx: number,
      y0: number,
      y1: number,
      color: string,
      alpha: number,
      dash: number[] = [],
    ) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(xx, y0);
      ctx.lineTo(xx, y1);
      ctx.stroke();
    };
    const trace = (
      pts: GlucosePoint[],
      yOf: (v: number) => number,
      maxGapMs = Infinity,
    ) => {
      ctx.beginPath();
      let prev: GlucosePoint | null = null;
      for (const p of pts) {
        if (!prev || p.time - prev.time > maxGapMs)
          ctx.moveTo(px(p.time), yOf(p.value));
        else ctx.lineTo(px(p.time), yOf(p.value));
        prev = p;
      }
    };

    // Forecast region
    if (xNow < W) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = pal.surfaceContainer;
      ctx.fillRect(Math.max(0, xNow), TOP, W - Math.max(0, xNow), plotH);
    }

    // Target band + range lines
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = pal.target;
    ctx.fillRect(
      0,
      py(range.highBG),
      W,
      Math.max(0, py(range.lowBG) - py(range.highBG)),
    );
    ctx.lineWidth = 1;
    hline(py(range.highBG), pal.elevated, 0.45, [4, 4]);
    hline(py(range.lowBG), pal.low, 0.5, [4, 4]);

    // Grid
    const yStepPx = niceYStep(yMax - yMin, plotH);
    for (let v = Math.ceil(yMin / yStepPx) * yStepPx; v <= yMax; v += yStepPx) {
      if (
        [range.lowBG, range.highBG].every((r) => Math.abs(py(v) - py(r)) > 13)
      )
        hline(py(v), pal.outlineVariant, 0.45);
    }
    const pxPerMin = innerW / (view.span / 60000);
    const tickStepMin =
      TICK_STEPS_MIN.find((m) => m * pxPerMin >= MIN_TICK_PX) ??
      TICK_STEPS_MIN[TICK_STEPS_MIN.length - 1];
    const tickMs = tickStepMin * 60000;
    const tzOffsetMs = new Date(startMs).getTimezoneOffset() * 60000;
    const xTicks: number[] = [];
    for (
      let t =
        Math.ceil((startMs - tickMs - tzOffsetMs) / tickMs) * tickMs +
        tzOffsetMs;
      t <= endMs + tickMs;
      t += tickMs
    )
      xTicks.push(t);
    for (const t of xTicks) {
      const day = isMidnight(t);
      vline(
        px(t),
        TOP,
        iobBottom,
        day ? pal.outline : pal.outlineVariant,
        day ? 0.7 : 0.45,
      );
    }

    // Activity spans
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = pal.secondary;
    for (const m of placed) {
      const ev = m.events[0];
      if (ev.end === undefined) continue;
      ctx.fillRect(
        px(ev.time),
        TOP,
        Math.max(0, px(ev.end) - px(ev.time)),
        plotH,
      );
    }

    /** Glucose curve value at t: CGM line up to the anchor, forecast after. */
    const curveAt = (t: number) =>
      anchorTime !== null && t > anchorTime
        ? interpolateAt(forecast, t)
        : interpolateAt(history, t);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP - 8, W, plotH + 16);
    ctx.clip();

    // Event guides: from the lane up to the curve
    for (const m of placed) {
      for (const ev of m.events) {
        if (ev.end !== undefined) continue;
        const ex = px(ev.time);
        if (ex < -10 || ex > W + 10) continue;
        const v = curveAt(ev.time);
        const cy = v !== null ? py(v) : TOP;
        const color = pal.kind[ev.kind];
        ctx.lineWidth = 1;
        vline(ex, cy, laneTop + m.row * ROW_H, color, 0.45, [2, 2]);
        if (v !== null) {
          ctx.globalAlpha = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(ex, cy, 4, 0, Math.PI * 2);
          ctx.fillStyle = pal.bg;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = color;
          ctx.stroke();
        }
      }
    }

    // CGM history
    const pxPerStep = (stepMs / 60000) * pxPerMin;
    const showDots = pxPerStep >= 4;
    const dotR = Math.min(3, Math.max(1.8, pxPerStep * 0.28));
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.lineWidth = 2;
    ctx.globalAlpha = showDots ? 0.35 : 0.95;
    ctx.strokeStyle = pal.primary;
    trace(vHistory, py, stepMs * 3);
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (const p of vHistory) {
      const cx = px(p.time);
      const cy = py(p.value);
      if (p.isCalibration) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx + 5, cy);
        ctx.lineTo(cx, cy + 5);
        ctx.lineTo(cx - 5, cy);
        ctx.closePath();
        ctx.fillStyle = pal.tertiary;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = pal.bg;
        ctx.stroke();
      } else if (showDots || p.time === anchorTime) {
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          p.time === anchorTime ? dotR + 1.6 : dotR,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = pal.tone[getGlucoseTone(p.value, range)];
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = pal.bg;
        ctx.stroke();
      }
    }

    // Forecast
    ctx.lineWidth = 2.25;
    ctx.strokeStyle = pal.primary;
    ctx.setLineDash([5, 4]);
    trace(vForecast, py);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const lastForecast =
      forecast.length > 0 ? forecast[forecast.length - 1] : null;
    if (lastForecast && px(lastForecast.time) <= W + 4) {
      const prev = forecast.length > 1 ? forecast[forecast.length - 2] : null;
      const falling = prev !== null && lastForecast.value < prev.value;
      const fx = px(lastForecast.time);
      const fy = py(lastForecast.value);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = pal.bg;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.primary;
      ctx.stroke();
      ctx.font = `700 11px ${pal.font}`;
      ctx.textAlign = "right";
      ctx.fillStyle = pal.primary;
      ctx.fillText(
        formatBG(lastForecast.value, decimal),
        fx - 6,
        fy + (falling ? 18 : -9),
      );
    }

    // Now marker
    if (xNow >= 0 && xNow <= W) {
      ctx.lineCap = "butt";
      ctx.lineWidth = 1.5;
      vline(xNow, TOP - 4, iobBottom, pal.primary, 1, [2, 3]);
      ctx.font = `700 10px ${pal.font}`;
      ctx.textAlign = "center";
      ctx.fillStyle = pal.primary;
      ctx.fillText("Now", xNow, TOP - 9);
    }

    // IOB strip: solid up to now, lighter and dashed after
    if (vIOB.length > 1) {
      const iobMax = Math.max(0.5, ...iobSamples.map((s) => s.value));
      const iobY = (v: number) => iobBottom - (v / iobMax) * (IOB_H - 6);
      const area = (
        x0: number,
        x1: number,
        fillAlpha: number,
        strokeAlpha: number,
        dash: number[],
      ) => {
        if (x1 <= x0) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, iobTop, x1 - x0, IOB_H);
        ctx.clip();
        trace(vIOB, iobY);
        ctx.lineTo(px(vIOB[vIOB.length - 1].time), iobBottom);
        ctx.lineTo(px(vIOB[0].time), iobBottom);
        ctx.closePath();
        ctx.globalAlpha = fillAlpha;
        ctx.fillStyle = pal.primary;
        ctx.fill();
        ctx.globalAlpha = strokeAlpha;
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = 1.25;
        ctx.setLineDash(dash);
        trace(vIOB, iobY);
        ctx.stroke();
        ctx.restore();
      };
      const split = Math.min(W, Math.max(0, xNow));
      area(0, split, 0.22, 0.7, []);
      area(split, W, 0.1, 0.35, [3, 3]);
    }
    ctx.lineWidth = 1;
    hline(iobBottom, pal.outlineVariant, 1);

    // Time axis
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.fillStyle = pal.textMuted;
    for (const t of xTicks) {
      ctx.font = `${isMidnight(t) ? 700 : 400} 10px ${pal.font}`;
      ctx.fillText(axisTimeLabel(t, tickStepMin), px(t), iobBottom + 15);
    }
  });

  return (
    <div
      ref={containerRef}
      className="hub-graph"
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
          <div
            className="hub-graph-viewport"
            style={{ width: innerRight, height }}
          >
            <canvas
              ref={canvasRef}
              className="hub-graph-canvas"
              style={{ width: innerRight, height }}
              aria-hidden="true"
            />
            <div
              className="hub-graph-layer"
              style={{
                width: layerW,
                height,
                transform: `translate3d(${layerDx}px, 0, 0)`,
              }}
            >
              {pills}
            </div>
          </div>

          <svg
            width={size.width}
            height={height}
            className="hub-graph-static"
            role="img"
            aria-label="Glucose history and forecast. Drag to scroll, pinch to zoom, press and hold to inspect."
          >
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

            {/* Scrub crosshair */}
            {scrub && x(scrub.time) >= 0 && x(scrub.time) <= innerRight && (
              <g>
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
