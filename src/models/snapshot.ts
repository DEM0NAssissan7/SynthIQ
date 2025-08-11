import SugarReading from "./types/sugarReading";

export default class Snapshot {
  _initialBG: SugarReading | null = null;
  _peakBG: SugarReading | null = null;
  _minBG: SugarReading | null = null;
  _finalBG: SugarReading | null = null;

  // Getters and setters
  set initialBG(value: SugarReading) {
    this._initialBG = value;
  }
  get initialBG(): SugarReading {
    if (!this._initialBG) throw new Error(`initialBG is null`);
    return this._initialBG;
  }

  set peakBG(value: SugarReading) {
    this._peakBG = value;
  }
  get peakBG(): SugarReading {
    if (!this._peakBG) throw new Error(`peakBG is null`);
    return this._peakBG;
  }

  set minBG(value: SugarReading) {
    this._minBG = value;
  }
  get minBG(): SugarReading {
    if (!this._minBG) throw new Error(`minBG is null`);
    return this._minBG;
  }

  set finalBG(value: SugarReading) {
    this._finalBG = value;
  }
  get finalBG(): SugarReading {
    if (!this._finalBG) throw new Error(`finalBG is null`);
    return this._finalBG;
  }

  static stringify(s: Snapshot) {
    return JSON.stringify({
      initialBG: s._initialBG ? SugarReading.stringify(s._initialBG) : null,
      peakBG: s._peakBG ? SugarReading.stringify(s._peakBG) : null,
      minBG: s._minBG ? SugarReading.stringify(s._minBG) : null,
      finalBG: s._finalBG ? SugarReading.stringify(s._finalBG) : null,
    });
  }
  static parse(s: string) {
    const o = JSON.parse(s);

    const snapshot = new Snapshot();
    snapshot._initialBG = o.initialBG ? SugarReading.parse(o.initialBG) : null;
    snapshot._peakBG = o.peakBG ? SugarReading.parse(o.peakBG) : null;
    snapshot._minBG = o.minBG ? SugarReading.parse(o.minBG) : null;
    snapshot._finalBG = o.finalBG ? SugarReading.parse(o.finalBG) : null;

    return snapshot;
  }
}
