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
export function genUUID(): number {
  return Math.round(random(0, 2 ** 16));
}

// Time stuff (non-timestamp)
export function getHoursMinutes(_min: number) {
  const minutes = floor(_min, 0);
  const hours = floor(minutes / 60, 0);
  let min: any = minutes - hours * 60;
  if(min < 10) min = "0" + min; // Make the minute look prettier
  return `${hours}:${min}`
}