type NutrientProfileCallback = (a: void) => void;

export default class NutrientProfile {
  subscribers: NutrientProfileCallback[] = [];
  subscribe(callback: NutrientProfileCallback) {
    this.subscribers.push(callback);
  }

  unsubscribe(callback: NutrientProfileCallback) {
    this.subscribers = this.subscribers.filter((a) => a !== callback);
  }
  notify() {
    this.subscribers.forEach((a) => a());
  }
}
