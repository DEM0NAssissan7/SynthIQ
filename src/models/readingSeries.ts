/* This class is an auto-populating series that pulls glucose
 * data from nightscout on its own
 */

import Series, { Color } from "./series";
import NightscoutManager from "../lib/nightscoutManager";
import { getHourDiff } from "../lib/timing";
import { smooth } from "../lib/optimizer";

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
        this.point(getHourDiff(timestamp, this.timestamp), sugar);
      });
      let nums: number[] = this.points.map((p) => p.y);
      nums = smooth(nums);
      this.points.forEach((p, i) => {
        p.y = nums[i];
      });
    });
  }
}

export default ReadingSeries;
