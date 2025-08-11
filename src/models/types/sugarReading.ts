export default class SugarReading {
  constructor(public sugar: number, public timestamp: Date) {}

  static stringify(r: SugarReading) {
    return JSON.stringify({
      sugar: r.sugar,
      timestamp: r.timestamp.toString(),
    });
  }
  static parse(s: string) {
    const o = JSON.parse(s);
    return new SugarReading(o.sugar, new Date(o.timestamp));
  }
}

export function getReadingFromNightscout(o: any): SugarReading {
  return new SugarReading(o.sgv, new Date(o.date));
}
export function createNightscoutReading(r: SugarReading) {
  return {
    sgv: r.sugar,
    date: r.timestamp,
  };
}
