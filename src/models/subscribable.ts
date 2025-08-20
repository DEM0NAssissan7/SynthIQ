import type { GeneralSubscriptionCallback } from "./types/types";

export default class Subscribable {
  subscriptions: GeneralSubscriptionCallback[] = [];
  // Subscriptions
  subscribe(callback: GeneralSubscriptionCallback) {
    this.subscriptions.push(callback);
  }
  unsubscribe(callback: GeneralSubscriptionCallback) {
    this.subscriptions = this.subscriptions.filter((sub) => sub !== callback);
  }
  notify() {
    this.subscriptions.forEach((f) => f());
  }

  addChildSubscribable(s: Subscribable) {
    s.subscribe(() => this.notify());
  }
  removeChildSubscribable(s: Subscribable) {
    s.unsubscribe(() => this.notify());
  }
}
