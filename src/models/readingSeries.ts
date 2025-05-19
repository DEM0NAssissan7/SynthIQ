/* This class is an auto-populating series that pulls glucose
 * data from nightscout on its own
 */

import Series, { Color } from "./series";
import NightscoutManager from "../lib/nightscoutManager";
import { getHourDiff } from "../lib/util";

class ReadingSeries extends Series {
  timestamp: Date;
  complete: boolean = false;

  constructor(color: Color, timestamp: Date) {
    super(color);
    this.timestamp = timestamp;
  }
  async populate(from: Date, until: Date) {
    NightscoutManager.getReadings(from, until).then((result: any) => {
      result.forEach((r: any) => {
        let sugar: number = r.sgv;
        let timestamp: Date = new Date(r.date);
        this.point(getHourDiff(this.timestamp, timestamp), sugar);
      });
    });
  }
}

export default ReadingSeries;
