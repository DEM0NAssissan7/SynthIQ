declare module "fmin" {
  export interface FMinResult {
    x: number[];
    fx: number;
    iterations: number;
  }

  export function nelderMead(
    f: (x: number[]) => number,
    x0: number[],
    options?: {
      maxIterations?: number;
      minErrorDelta?: number;
      minTolerance?: number;
    }
  ): FMinResult;
}
