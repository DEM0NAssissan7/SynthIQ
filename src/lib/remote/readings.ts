import Backend from "./backend";

class RemoteReadings {
  /** Every CGM reading between two times. Throws if Nightscout could not be read. */
  static async getReadings(
    timestampA: Date,
    timestampB: Date,
  ): Promise<
    {
      sgv?: number;
      mbg?: number;
      date?: string | number;
      dateString?: string;
      type?: string;
    }[]
  > {
    const from = Math.min(timestampA.getTime(), timestampB.getTime());
    const to = Math.max(timestampA.getTime(), timestampB.getTime());

    // Nightscout date range queries:
    // In Nightscout MongoDB, `date` is a numeric epoch field. Querying `find[date][$gte]=<val>` fails
    // in standard Nightscout instances because Express query strings parse all parameters as strings,
    // which yields 0 matches in BSON numeric comparisons.
    // Querying by ISO `find[dateString][$gte]=...` matches the string field properly.
    let res = await Backend.getAll("entries/sgv.json", "dateString", from, to);
    if (res.length > 0) return res;
    // Fallback 1: Query entries.json using dateString
    res = await Backend.getAll("entries.json", "dateString", from, to);
    if (res.length > 0) return res;
    // Fallback 2: Query entries/sgv.json using numeric epoch
    res = await Backend.getAll("entries/sgv.json", "date", from, to);
    if (res.length > 0) return res;
    // Fallback 3: Query entries.json using numeric epoch
    return await Backend.getAll("entries.json", "date", from, to);
  }
  /**
   * Meter (fingerstick) entries between two times. Queried by dateString for
   * the same reason as getReadings (numeric date queries match nothing).
   */
  static async getMeterReadings(timestampA: Date, timestampB: Date) {
    const from = Math.min(timestampA.getTime(), timestampB.getTime());
    const to = Math.max(timestampA.getTime(), timestampB.getTime());
    return await Backend.getAll("entries/mbg.json", "dateString", from, to);
  }
}

export default RemoteReadings;
