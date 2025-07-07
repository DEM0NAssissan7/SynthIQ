/**
 * A utility class containing mathematical functions that represent
 * integrals starting at zero. These functions return 0 for `t < 0`
 * and have an infinite area of 1, where the output number is
 * constantly increasing.
 */

const LN2 = Math.log(2);

type PArg = [r: number, p: number, f: number];
type Barg = [k_a: number, k: number];

export default class MetaFunctions {
  // All functions in this class are integrals that start at zero
  // (and return 0 for t<0) and have an infinite area of 1 where
  // The output number is constantly increasing
  static H(t: number, h: number): number {
    // Half-life decay
    // t -> time elapsed
    // h -> half-life
    return 1 - Math.exp((-t * LN2) / h);
  }
  static G(t: number, p: number): number {
    // Parabolic function with adjustable peak
    // r = ((3 / (4 * (p ** 3))) * ((p ** 2) - ((t - p) ** 2))); -> This was the original function that was then integrated into the return function

    if (p <= 0) {
      return 0;
    }
    if (t >= p * 2) return 1;

    return (
      (3 * Math.pow(t, 2)) / (4 * Math.pow(p, 2)) -
      Math.pow(t, 3) / (4 * Math.pow(p, 3))
    );
  }
  static C(t: number, z: number): number {
    // Constant function: has an area under it of 1 and will linearly increase from 0->z until it returns 1
    if (t >= z) return 1;
    return t / z;
  }
  static P(t: number, [r, p, f]: PArg): number {
    // t -> time
    // r -> rise
    // p -> plateau
    // f -> fall
    if (t >= r + p + f) return 1;

    let y = 1 / (0.5 * r + p + 0.5 * f);

    if (t < r) return 0.5 * (y / r) * t * t;
    if (t < r + p) return y * t - (y * r) / 2;
    let _t = t - r - p;
    if (t < r + p + f)
      return y * _t - 0.5 * (y / f) * (_t * _t) + y * (r + p) - (y * r) / 2;
    return 1; // Redundant
  }
  static B(t: number, [k_a, k]: Barg) {
    // Bateman function
    return (k_a / (k_a - k)) * (Math.exp(-k * t) - Math.exp(-k_a * t));
  }
  static iB(t: number, [k_a, k]: Barg) {
    // Integral of the bateman function (with an infinite integral of 1)
    const AUC = 1 / k;
    return (
      ((k_a / (k_a - k)) *
        ((1 - Math.exp(-k * t)) / k - (1 - Math.exp(-k_a * t)) / k_a)) /
      AUC
    );
  }
}

export function metaKernel(
  t: number,
  e: number,
  n: number,
  p: any,
  f: Function
) {
  // t -> time elapsed
  // e -> magnitude
  // n -> delay
  // p -> arbitrary argument that nature of the curve
  if (e === 0) return 0;
  if (t - n <= 0) return 0;
  return e * f(t - n, p);
}
