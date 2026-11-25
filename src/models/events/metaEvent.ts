import { genUUID } from "../../lib/util";
import Subscribable from "../subscribable";
import type { UUID } from "../types/types";

export default class MetaEvent extends Subscribable {
  _timestamp: Date;
  uuid: UUID;

  constructor(timestamp: Date, uuid: UUID | null) {
    super();
    this._timestamp = timestamp;
    this.uuid = uuid ?? genUUID();
  }

  set timestamp(t: Date) {
    this._timestamp = t;
    this.notify();
  }
  get timestamp() {
    return this._timestamp;
  }
}
