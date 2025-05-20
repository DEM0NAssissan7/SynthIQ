export enum Color {
  Black = "black",
  White = "white",
  Red = "red",
  Yellow = "yellow",
  Green = "green",
  Blue = "blue",
  LightBlue = "light blue",
}

type SubscriberCallback = () => void;

class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
class Series {
  points: Point[] = [];
  color: Color;
  callbacks: SubscriberCallback[] = [];

  constructor(color: Color = Color.Black) {
    this.color = color;
  }
  point(x: number, y: number): void {
    for (let p of this.points) {
      if (p.x === x) {
        p.y = y;
        this.notify();
        return;
      }
    }
    let point = new Point(x, y);
    this.points.push(point);
    this.notify();
  }
  at(x: number): number {
    // Find the closest point to the point at x
    let y: number = NaN;
    let diff: number = Infinity;
    let d;
    this.points.forEach((p) => {
      d = Math.abs(p.x - x);
      if (d < diff) {
        diff = d;
        y = p.y;
      }
    });
    return y;
  }
  getRechartData(): object {
    return this.points.map((p) => {
      return {
        x: p.x,
        y: p.y,
      };
    });
  }

  // Subscriptions
  subscribe(callback: SubscriberCallback): void {
    this.callbacks.push(callback);
  }
  unsubscribe(callback: SubscriberCallback): void {
    this.callbacks = this.callbacks.filter((l) => l !== callback);
  }
  notify(): void {
    this.callbacks.forEach((a) => a());
  }
}

export default Series;
