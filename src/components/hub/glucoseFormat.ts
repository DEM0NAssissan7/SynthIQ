import { round } from "../../lib/util";

export function formatBG(value: number, decimal: boolean): string {
  return decimal ? round(value, 1).toFixed(1) : Math.round(value).toString();
}

export function formatDose(value: number): string {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function formatClock(timeMs: number): string {
  return new Date(timeMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "45 min", "2h 5m" */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/** "now", "in 25 min", "2h 5m ago" */
export function formatRelative(timeMs: number, nowMs: number): string {
  const diffMin = Math.round((timeMs - nowMs) / 60000);
  if (diffMin === 0) return "now";
  if (diffMin > 0) return `in ${formatDuration(diffMin)}`;
  return `${formatDuration(-diffMin)} ago`;
}

export type GlucoseTone = "low" | "high" | "target";

export interface GlucoseStatus {
  label: string;
  tone: GlucoseTone;
}

export interface GlucoseRange {
  targetBG: number;
  lowBG: number;
  highBG: number;
  dangerBG: number;
}

export function getGlucoseTone(
  value: number,
  range: GlucoseRange,
): GlucoseTone {
  if (value < range.lowBG) return "low";
  if (value > range.highBG) return "high";
  return "target";
}

export function getGlucoseStatus(
  value: number | null,
  range: GlucoseRange,
): GlucoseStatus | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  const tone = getGlucoseTone(value, range);
  if (tone === "low") return { label: "Low", tone };
  if (tone === "high") return { label: "Elevated", tone };
  if (Math.abs(value - range.targetBG) <= 10)
    return { label: "On Target", tone };
  return { label: "In Range", tone };
}

export const toneColor: Record<GlucoseTone, string> = {
  low: "var(--app-status-low)",
  high: "var(--app-status-elevated)",
  target: "var(--app-status-target)",
};

export interface DeltaTrend {
  delta: number;
  formatted: string;
  color: string;
}

/**
 * Change from `startBG` to `predictedBG`, colored by whether it heads toward
 * target (green), away from it (amber), or is a rapid/hypo-bound drop (red).
 */
export function getDeltaTrend({
  startBG,
  predictedBG,
  range,
  decimal,
  durationMinutes,
}: {
  startBG: number;
  predictedBG: number | null;
  range: GlucoseRange;
  decimal: boolean;
  durationMinutes: number;
}): DeltaTrend | null {
  if (
    predictedBG === null ||
    !Number.isFinite(predictedBG) ||
    !Number.isFinite(startBG)
  ) {
    return null;
  }

  const delta = predictedBG - startBG;
  const abs = Math.abs(delta);
  const numStr = decimal ? abs.toFixed(1) : Math.round(abs).toString();
  const formatted =
    delta > 0 ? `+${numStr}` : delta < 0 ? `-${numStr}` : numStr;

  const epsilon = decimal ? 0.05 : 0.5;
  if (abs < epsilon) {
    return { delta, formatted, color: "var(--app-text-muted)" };
  }

  const isTowardTarget =
    Math.abs(predictedBG - range.targetBG) < Math.abs(startBG - range.targetBG);
  const durationHours = durationMinutes > 0 ? durationMinutes / 60 : 0;
  const dropRatePerHour =
    durationHours > 0 && delta < 0 ? abs / durationHours : 0;

  const isHeadingAwayDownwards =
    delta < 0 && (predictedBG < range.targetBG || !isTowardTarget);
  const isHypoRisk = predictedBG < range.lowBG;
  const isRapidDrop =
    isHeadingAwayDownwards && (isHypoRisk || dropRatePerHour >= 60);

  let color: string;
  if (isRapidDrop || predictedBG <= range.dangerBG) {
    color = toneColor.low;
  } else if (isTowardTarget && !isHypoRisk) {
    color = toneColor.target;
  } else {
    color = toneColor.high;
  }
  return { delta, formatted, color };
}
