import Unit from "../models/unit";

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

// Number Generation
export function genUUID(): number {
  return Math.round(random(0, 2 ** 16));
}

// Timestamp
export function getEpochMinutes(date: Date): number {
  return Math.round(
    date.getTime() * convertDimensions(Unit.Time.Millis, Unit.Time.Minute)
  );
}
export function getEpochHours(date: Date): number {
  return date.getTime() * convertDimensions(Unit.Time.Millis, Unit.Time.Hour);
}
export function getHourDiff(timestampA: Date, timestampB: Date): number {
  return (getEpochMinutes(timestampB) - getEpochMinutes(timestampA)) / 60;
}
export function getTimestampFromOffset(timestamp: Date, offset: number): Date {
  let unixTimestamp = timestamp.getTime();
  let offsetMillis =
    offset * convertDimensions(Unit.Time.Hour, Unit.Time.Millis);
  return new Date(unixTimestamp + offsetMillis);
}
