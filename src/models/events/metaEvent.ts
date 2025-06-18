export default class MetaEvent {
  _timestamp: Date;
  subscriptions: (() => void)[] = [];

  constructor(timestamp: Date) {
    this._timestamp = timestamp;
  }

  // Subscriptions
  subscribe(callback: () => void) {
    this.subscriptions.push(callback);
  }
  unsubscribe(callback: () => void) {
    this.subscriptions = this.subscriptions.filter((sub) => sub !== callback);
  }
  notify() {
    this.subscriptions.forEach((f) => f());
  }

  set timestamp(t: Date) {
    this._timestamp = t;
    this.notify();
  }
  get timestamp() {
    return this._timestamp;
  }
}
