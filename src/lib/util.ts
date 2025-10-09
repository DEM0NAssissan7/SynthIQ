// Units
export function convertDimensions(source: number, destination: number): number {
  return source / destination;
}

// General Number Operations
export function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
export function round(num: number, precision: number): number {
  return Math.round(num * 10 ** precision) / 10 ** precision;
}
export function floor(num: number, precision: number): number {
  return Math.floor(num * 10 ** precision) / 10 ** precision;
}
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Number Generation
export type UUID = number;
export function genUUID(): UUID {
  return Math.round(random(0, 2 ** 16));
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
    return this.sum(data) / data.length;
  }
  static median(data: number[]): number {
    if (data.length === 0) return 0;
    const sortedArray = data.slice().sort((a, b) => a - b);
    const mid = Math.floor(sortedArray.length / 2);
    if (sortedArray.length % 2 !== 0) return sortedArray[mid];
    else return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
  }
  static mode(data: number[]): number | null {
    if (data.length === 0) return null;

    const frequency: { [key: number]: number } = {};
    data.forEach((a) => {
      frequency[a] = (frequency[a] || 0) + 1;
    });

    const freqs = Object.values(frequency);
    const maxFreq = Math.max(...freqs);

    // Check if all values appear the same number of times
    const allSame = freqs.every((f) => f === maxFreq);
    if (allSame) return null;

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
  static absoluteDeviations(x: number, data: number[]): number[] {
    return data.map((x_i) => Math.abs(x_i - x));
  }
  static medianAbsoluteDeviation(data: number[]): number {
    const median = this.median(data);
    const deviations = this.absoluteDeviations(median, data);

    return this.median(deviations) || 0;
  }
}
