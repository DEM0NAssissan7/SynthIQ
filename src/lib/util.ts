export function convertDimensions(source: number, destination: number): number {
  return destination / source;
}

// General Number Operations
export function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
export function round(num: number, precision: number): number {
  return Math.round(num * 10 ** precision) / 10 ** precision;
}

// Number Generation
export function genUUID(): number {
  return Math.round(random(0, 2 ** 16));
}

// Timestamp
export function getEpochMinutes(date: Date): number {
  return Math.round(date.getTime() / 1000 / 60);
}
export function getHourDiff(timestampA: Date, timestampB: Date): number {
  return (getEpochMinutes(timestampB) - getEpochMinutes(timestampA)) / 60;
}
