import Subscribable from "../subscribable";

export default class MetaEvent extends Subscribable {
  _timestamp: Date;

  constructor(timestamp: Date) {
    super();
    this._timestamp = timestamp;
  }

  set timestamp(t: Date) {
    this._timestamp = t;
    this.notify();
  }
  get timestamp() {
    return this._timestamp;
  }
}
