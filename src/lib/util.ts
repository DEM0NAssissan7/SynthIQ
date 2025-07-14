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

// Statistics
export class MathUtil {
  static mean(data: number[]): number {
    if (data.length === 0) return 0;
    let retval = 0;
    data.forEach((a) => {
      retval += a;
    });
    retval = retval / data.length;
    return retval;
  }
  static median(data: number[]): number {
    if (data.length === 0) return 0;
    const sortedArray = data.slice().sort((a, b) => a - b);
    const mid = Math.floor(sortedArray.length / 2);
    if (sortedArray.length % 2 !== 0) return sortedArray[mid];
    else return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
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
}
