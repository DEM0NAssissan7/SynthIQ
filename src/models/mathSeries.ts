import Series, { Color } from "./series";

export type SeriesFunction = (t: number) => number;

class MathSeries extends Series {
  functions: SeriesFunction[];

  constructor(color: Color, functions: SeriesFunction[]) {
    super(color);
    this.functions = functions;
  }
  addFunction(f: SeriesFunction) {
    this.functions.push(f);
  }
  sumFunctions(t: number): number {
    let retval = 0;
    this.functions.map((f) => (retval += f(t)));
    return retval;
  }
  populate(a: number, b: number, interval: number) {
    for (let x = a; x < b; x += interval) {
      this.point(x, this.sumFunctions(x));
    }
  }
}

export default MathSeries;
