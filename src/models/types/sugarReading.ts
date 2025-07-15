export type SugarReading = {
  sugar: number;
  timestamp: Date;
};

export function getReadingFromNightscout(o: any): SugarReading {
  return {
    sugar: o.sgv,
    timestamp: new Date(o.timestamp),
  };
}
