import type { UUID } from "../models/types/types";

// Units
export function convertDimensions(source: number, destination: number): number {
  return source / destination;
}

// General Number Operations
export function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
export function round(num: number, precision: number = 0): number {
  return Math.round(num * 10 ** precision) / 10 ** precision;
}
export function floor(num: number, precision: number): number {
  return Math.floor(num * 10 ** precision) / 10 ** precision;
}
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Search
/**
 * Binary search: the index of the first item for which `isAtOrPast` holds, or
 * `array.length` if none does. The array must be ordered so that it fails up
 * to some point and holds from there on (e.g. "at or after time X" on a
 * time-sorted array).
 */
export function firstIndexWhere<T>(
  array: readonly T[],
  isAtOrPast: (item: T) => boolean,
): number {
  let low = 0;
  let high = array.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (isAtOrPast(array[mid])) high = mid;
    else low = mid + 1;
  }
  return low;
}

// Number Generation
export function genUUID(): UUID {
  return Math.round(random(0, 2 ** 32));
}

// Time stuff (non-timestamp)
export function getHoursMinutes(_min: number) {
  const minutes = floor(_min, 0);
  const hours = floor(minutes / 60, 0);
  let min: any = minutes - hours * 60;
  if (min < 10) min = "0" + min; // Make the minute look prettier
  return `${hours}:${min}`;
}

// Helpers
export function roundByHalf(x: number, ceilUp: boolean = true) {
  if (x === 0) return 0;
  return Math.floor(x * 2 + (ceilUp ? 1 : 0)) / 2;
}

// Statistics
export class MathUtil {
  static sum(data: number[]): number {
    if (data.length === 0) return 0;
    let retval = 0;
    data.forEach((a) => {
      retval += a;
    });
    return retval;
  }
  static mean(data: number[]): number {
    if (data.length === 0) return 0;
    return this.sum(data) / data.length;
  }
  static median(data: number[]): number {
    if (data.length === 0) return 0;
    const sortedArray = data.slice().sort((a, b) => a - b);
    const mid = Math.floor(sortedArray.length / 2);
    if (sortedArray.length % 2 !== 0) return sortedArray[mid];
    else return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
  }
  static mode(data: number[]): number {
    if (data.length === 0) return 0;

    const frequency: { [key: number]: number } = {};
    data.forEach((a) => {
      frequency[a] = (frequency[a] || 0) + 1;
    });

    const freqs = Object.values(frequency);
    const maxFreq = Math.max(...freqs);

    // Check if all values appear the same number of times
    const allSame = freqs.every((f) => f === maxFreq);
    if (allSame) return data[0]; // If they are all the same, just return something

    let mode = Number(Object.keys(frequency)[0]);
    for (const key in frequency) {
      if (frequency[key] === maxFreq) {
        mode = Number(key);
        break;
      }
    }

    return mode;
  }
  static stdev(data: number[]): number {
    const denominator = data.length - 1;
    if (denominator <= 0) return 0;

    let sum = 0;
    const mean = this.mean(data);
    data.forEach((a) => {
      sum += (mean - a) ** 2;
    });
    return Math.sqrt(sum / denominator);
  }
  static percentError(accepted: number, observed: number) {
    return Math.abs((observed - accepted) / accepted) * 100;
  }
  static percentDifference(v1: number, v2: number) {
    const max = Math.max(v1, v2);
    if (max === 0) return 0;
    return (Math.abs(v1 - v2) / max) * 100;
  }
  static absoluteDeviations(x: number, data: number[]): number[] {
    return data.map((x_i) => Math.abs(x_i - x));
  }
  static meanAbsoluteDeviation(data: number[]): number {
    const mean = this.mean(data);
    const deviations = this.absoluteDeviations(mean, data);

    return this.mean(deviations) || 0;
  }
  static medianAbsoluteDeviation(data: number[]): number {
    const median = this.median(data);
    const deviations = this.absoluteDeviations(median, data);

    return this.median(deviations) || 0;
  }
  static getPercentile(data: number[], percentile: number) {
    const sorted = data.slice().sort((a, b) => a - b);
    const index = Math.floor(sorted.length * percentile);
    return sorted[index];
  }
  static Q1(data: number[]): number {
    return this.getPercentile(data, 0.25);
  }
  static IQR(data: number[]): number {
    const sorted = data.slice().sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    return sorted[q3Index] - sorted[q1Index];
  }
  /**
   * The largest x >= 0 where `holds(x)` is true, searching up from `start` (> 0). Assumes it
   * holds from 0 up to some point and fails after it. Always returns a value where it holds.
   */
  static largestWhere(holds: (x: number) => boolean, start: number): number {
    let lo = 0;
    let hi = start;
    while (holds(hi)) {
      lo = hi;
      hi *= 2;
      if (!Number.isFinite(hi)) return Infinity;
    }
    for (let i = 0; i < 100 && hi - lo > 1e-9 * hi; i++) {
      const mid = 0.5 * (lo + hi);
      if (holds(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  /**
   * The closest curve to evenly spaced data that never goes down. Any stretch that goes
   * down is merged into one block at its average (pool adjacent violators), then straight
   * lines are drawn between the middles of the blocks instead of leaving flat steps.
   */
  static isotonicLinear(data: number[]): number[] {
    if (data.length === 0) return [];
    const blocks: { sum: number; count: number; start: number }[] = [];
    const value = (b: { sum: number; count: number }) => b.sum / b.count;
    data.forEach((x, i) => {
      blocks.push({ sum: x, count: 1, start: i });
      while (
        blocks.length > 1 &&
        value(blocks[blocks.length - 2]) > value(blocks[blocks.length - 1])
      ) {
        const b = blocks.pop()!;
        const a = blocks[blocks.length - 1];
        a.sum += b.sum;
        a.count += b.count;
      }
    });
    const middles = blocks.map((b) => b.start + (b.count - 1) / 2);
    const values = blocks.map(value);

    const out: number[] = [];
    let k = 0;
    for (let i = 0; i < data.length; i++) {
      if (i <= middles[0]) out.push(values[0]);
      else if (i >= middles[middles.length - 1])
        out.push(values[values.length - 1]);
      else {
        while (middles[k + 1] < i) k++;
        const f = (i - middles[k]) / (middles[k + 1] - middles[k]);
        out.push(values[k] + f * (values[k + 1] - values[k]));
      }
    }
    return out;
  }
}
