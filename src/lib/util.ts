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

// Number Generation
export function genUUID(): number {
  return Math.round(random(0, 2 ** 16));
}
