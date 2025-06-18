import Unit, { getTimeUnitPrettyName } from "../models/unit";
import { convertDimensions, round } from "./util";

// Epoch relative
export function getEpochMinutes(date: Date): number {
  return Math.round(
    date.getTime() * convertDimensions(Unit.Time.Millis, Unit.Time.Minute)
  );
}
export function getEpochHours(date: Date): number {
  return date.getTime() * convertDimensions(Unit.Time.Millis, Unit.Time.Hour);
}

// Time difference
export function getHourDiff(timestampA: Date, timestampB: Date): number {
  return (getEpochMinutes(timestampA) - getEpochMinutes(timestampB)) / 60;
}
export function getMinuteDiff(timestampA: Date, timestampB: Date): number {
  return getEpochMinutes(timestampA) - getEpochMinutes(timestampB);
}

export function getTimestampFromOffset(timestamp: Date, hours: number): Date {
  const unixTimestamp = timestamp.getTime();
  const offsetMillis =
    hours * convertDimensions(Unit.Time.Hour, Unit.Time.Millis);
  return new Date(unixTimestamp + offsetMillis);
}

// Pretty things
export function getPrettyTimeDiff(
  timestampVictim: Date,
  timestamp: Date,
  unit: Unit.Time
) {
  let timediff =
    getHourDiff(timestampVictim, timestamp) *
    convertDimensions(Unit.Time.Hour, unit);
  if (timediff === 0) return "as soon as";
  const prefix = `${Math.abs(round(timediff, 0))} ${getTimeUnitPrettyName(
    unit
  )}`;
  if (timediff > 0) return `${prefix} after`;
  if (timediff < 0) return `${prefix} before`;
}
export function getPrettyTime(timestamp: Date): string {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const prettyTime = `${hours}:${minutes} ${ampm}`;
  return prettyTime;
}
export function getFullPrettyDate(timestamp: Date): string {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year} (${getPrettyTime(timestamp)})`;
}
