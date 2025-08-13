import type { SubscriptionCallback } from "./types/subscriptionCallback";

export default class Subscribable {
  subscriptions: SubscriptionCallback[] = [];
  // Subscriptions
  subscribe(callback: SubscriptionCallback) {
    this.subscriptions.push(callback);
  }
  unsubscribe(callback: SubscriptionCallback) {
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
