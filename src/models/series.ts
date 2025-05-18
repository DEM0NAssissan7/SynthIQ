type Point = [number, number];
export enum Color {
  Black = "black",
  White = "white",
  Red = "red",
  Yellow = "yellow",
  Green = "green",
  Blue = "blue",
  LightBlue = "light blue",
}

class Series {
  points: Point[] = [];
  color: Color;
  constructor(color: Color = Color.Black) {
    this.color = color;
  }
  point(x: number, y: number): void {
    let point: Point = [x, y];
    this.points.push(point);
  }
  at(x: number): number {
    // Find the closest point to the point at x
    let y: number = NaN;
    let diff: number = Infinity;
    let d;
    this.points.forEach((p) => {
      d = Math.abs(p[0] - x);
      if (d < diff) {
        diff = d;
        y = p[1];
      }
    });
    return y;
  }
}

export default Series;
