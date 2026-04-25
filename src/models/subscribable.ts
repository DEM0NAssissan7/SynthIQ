import type { GeneralSubscriptionCallback } from "./types/types";

export default class Subscribable {
  subscriptions: GeneralSubscriptionCallback[] = [];
  childSubscriptions = new Map<Subscribable, GeneralSubscriptionCallback>();

  // Subscriptions
  subscribe(callback: GeneralSubscriptionCallback) {
    this.subscriptions.push(callback);
    return () => this.unsubscribe(callback); // return explicit reference to unsubscriber
  }
  unsubscribe(callback: GeneralSubscriptionCallback) {
    this.subscriptions = this.subscriptions.filter((sub) => sub !== callback);
  }
  notify() {
    this.subscriptions.forEach((f) => f());
  }

  addChildSubscribable(s: Subscribable) {
    if (this.childSubscriptions.has(s)) return; // Don't subscribe twice
    const unsubscribe = s.subscribe(() => this.notify());
    this.childSubscriptions.set(s, unsubscribe);
  }

  removeChildSubscribable(s: Subscribable) {
    this.childSubscriptions.get(s)?.();
    this.childSubscriptions.delete(s);
  }
}
