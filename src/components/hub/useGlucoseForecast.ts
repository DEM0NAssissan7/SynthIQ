import { useMemo } from "react";
import { BackendStore } from "../../storage/backendStore";
import { PreferencesStore } from "../../storage/preferencesStore";
import { getPredictedGlucose } from "../../lib/glucosePrediction";
import { getPredictedGlucoseAccuracyCached } from "../../lib/predictionCache";
import {
  getBGVelocity,
  getLatestReadings,
  getR1Context,
  getReadingsHistory,
  getRecentBoluses,
  getRecentRescues,
} from "../../lib/healthMonitor";
import { useStream } from "../../state/useStream";
import { ReadingType } from "../../models/types/sugarReading";

/** How far past now the forecast line extends. */
export const FORECAST_HORIZON_MS = 60 * 60 * 1000;

export interface GlucosePoint {
  time: number;
  value: number;
  type?: ReadingType;
}

export interface ForecastAccuracy {
  meanAvgDeviation: number;
  percentCorrect: number;
  percentWithinVariance: number;
  meanDeviation30min: number | null;
  meanDeviation60min: number | null;
}

function finiteOrNull(x: number | undefined): number | null {
  return x !== undefined && Number.isFinite(x) && x > 0 ? x : null;
}

/**
 * CGM history, the forecast (r1-corrected unless disabled in settings) and its live accuracy, all from the
 * stream. The forecast series is recomputed once per CGM
 * interval (or when readings/treatments change), not on every clock tick;
 * only the "now" estimate tracks the clock.
 */
export function useGlucoseForecast(now: Date) {
  const [stream, streamVersion] = useStream();
  // Short horizon: the exact input every prediction is made from.
  const readings = useMemo(() => getLatestReadings(stream), [streamVersion]);
  // Long horizon: display only.
  const readingsHistory = useMemo(
    () => getReadingsHistory(stream, now),
    [streamVersion],
  );
  const boluses = useMemo(() => getRecentBoluses(stream), [streamVersion]);
  const rescues = useMemo(() => getRecentRescues(stream), [streamVersion]);
  const { meals, basalTimes } = useMemo(
    () => getR1Context(stream, now),
    [streamVersion],
  );
  const [cgmDelayRaw] = BackendStore.cgmDelay.useState();
  const [useR1] = PreferencesStore.useRSeriesPredictor.useState();
  const stepMs = (cgmDelayRaw && cgmDelayRaw > 0 ? cgmDelayRaw : 5) * 60000;

  const r1Context = useMemo(
    () => ({
      meals: meals.map((m) => ({
        timeMs: m.timestamp.getTime(),
        carbs: m.carbs,
        protein: m.protein,
      })),
      basalTimesMs: basalTimes,
    }),
    [meals, basalTimes],
  );

  const history = useMemo<GlucosePoint[]>(() => {
    const byTime = new Map<number, GlucosePoint>();
    for (const r of [...readingsHistory, ...readings]) {
      if (r.timestamp && Number.isFinite(r.sugar) && r.sugar > 0) {
        const time = r.timestamp.getTime();
        byTime.set(time, {
          time,
          value: r.sugar,
          type: r.type,
        });
      }
    }
    return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  }, [readings, readingsHistory]);

  // The prediction anchor is the newest reading of the short cache.
  const anchor = useMemo<GlucosePoint | null>(() => {
    let newest: GlucosePoint | null = null;
    for (const r of readings) {
      const time = r.timestamp.getTime();
      if (
        Number.isFinite(r.sugar) &&
        r.sugar > 0 &&
        (!newest || time > newest.time)
      )
        newest = { time, value: r.sugar, type: r.type };
    }
    return newest;
  }, [readings]);

  const predictedNow = useMemo(() => {
    const p = getPredictedGlucose(
      readings,
      now,
      boluses,
      rescues,
      r1Context,
      undefined,
      useR1,
    );
    return p !== null && Number.isFinite(p) ? p : null;
  }, [readings, now, boluses, rescues, r1Context, useR1]);

  const velocity = useMemo(() => getBGVelocity(readings), [readings]);

  const accuracy = useMemo<ForecastAccuracy | null>(() => {
    if (readings.length < 3) return null;
    const chronological = readings
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const result = getPredictedGlucoseAccuracyCached(
      chronological,
      boluses,
      rescues,
      2,
      r1Context,
      useR1,
    );
    if (
      !result ||
      !Number.isFinite(result.meanAvgDeviation) ||
      result.meanAvgDeviation <= 0
    ) {
      return null;
    }
    return {
      meanAvgDeviation: result.meanAvgDeviation,
      percentCorrect: Number.isFinite(result.percentCorrect)
        ? result.percentCorrect
        : 0,
      percentWithinVariance: Number.isFinite(result.percentWithinVariance)
        ? result.percentWithinVariance
        : 0,
      meanDeviation30min: finiteOrNull(result.meanDeviation30min),
      meanDeviation60min: finiteOrNull(result.meanDeviation60min),
    };
  }, [readings, boluses, rescues, r1Context, useR1]);

  // Forecast at CGM-interval steps from the anchor reading out to the horizon.
  const nowBucket = Math.floor(now.getTime() / stepMs);
  const forecastSteps = useMemo<GlucosePoint[]>(() => {
    if (!anchor) return [];
    const points: GlucosePoint[] = [{ time: anchor.time, value: anchor.value }];
    const end =
      Math.max(anchor.time, (nowBucket + 1) * stepMs) + FORECAST_HORIZON_MS;
    for (let t = anchor.time + stepMs; t <= end; t += stepMs) {
      const p = getPredictedGlucose(
        readings,
        new Date(t),
        boluses,
        rescues,
        r1Context,
        undefined,
        useR1,
      );
      if (p !== null && Number.isFinite(p)) points.push({ time: t, value: p });
    }
    return points;
  }, [anchor, readings, boluses, rescues, r1Context, useR1, nowBucket, stepMs]);

  // Splice the exact "now" estimate in so the line passes through the
  // number shown in the header.
  const forecast = useMemo<GlucosePoint[]>(() => {
    const nowMs = now.getTime();
    if (predictedNow === null || !anchor || nowMs <= anchor.time)
      return forecastSteps;
    const merged = forecastSteps.filter(
      (p) => Math.abs(p.time - nowMs) >= 30 * 1000,
    );
    merged.push({ time: nowMs, value: predictedNow });
    return merged.sort((a, b) => a.time - b.time);
  }, [forecastSteps, predictedNow, now, anchor]);

  return {
    history,
    anchor,
    forecast,
    predictedNow,
    velocity,
    accuracy,
    stepMs,
    boluses,
    rescues,
    meals,
    basalTimes,
  };
}

/** Linear interpolation over time-sorted points; null outside their span. */
export function interpolateAt(
  points: GlucosePoint[],
  t: number,
): number | null {
  if (points.length === 0) return null;
  if (t < points[0].time || t > points[points.length - 1].time) return null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (t <= b.time) {
      const span = b.time - a.time;
      return span <= 0
        ? b.value
        : a.value + ((b.value - a.value) * (t - a.time)) / span;
    }
  }
  return points[points.length - 1].value;
}
