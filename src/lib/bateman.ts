/**
 * All functions here are normalized from 0->1
 * Bateman.f returns a number from 0->1, and its integral from 0->inf is 1
 * limit of Bateman.F as t approaches infinity is 1
 */
export namespace Bateman {
  export const completionConstant = 0.93;
  export function f(t: number, ka: number, ke: number) {
    if (t <= 0) return 0;
    if (!Number.isFinite(ka) || !Number.isFinite(ke) || ka <= 0 || ke <= 0) return 0;
    if (Math.abs(ka - ke) < 1e-12) {
      // Equal-rate case: use the CDF G(t) = Γ(2, kt) → k²·t·exp(-kt)
      const k = ka;
      return k * k * t * Math.exp(-k * t);
    }
    const A = (ka * ke) / (ke - ka);
    return A * (Math.exp(-ka * t) - Math.exp(-ke * t));
  }

  export function F(t: number, ka: number, ke: number) {
    if (t <= 0) return 0;
    if (!Number.isFinite(ka) || !Number.isFinite(ke) || ka <= 0 || ke <= 0) return 0;
    if (Math.abs(ka - ke) < 1e-12) {
      // Equal-rate case: F(t) = 1 - (1 + kt)·exp(-kt)
      const k = ka;
      return 1 - (1 + k * t) * Math.exp(-k * t);
    }
    const A = (ka * ke) / (ke - ka);
    return A * ((1 - Math.exp(-ka * t)) / ka - (1 - Math.exp(-ke * t)) / ke);
  }

  export function area(a: number, b: number, ka: number, ke: number) {
    return F(b, ka, ke) - F(a, ka, ke);
  }
  export function Finv(
    x: number,
    ka: number,
    ke: number,
    tol = 1e-6,
    maxIter = 50,
  ) {
    // Bateman curves do not inverse analytically, so we use Newton search
    if (x <= 0) return 0;
    if (x >= 1) return Infinity;

    let t = 1; // initial guess
    for (let i = 0; i < maxIter; i++) {
      const Ft = Bateman.F(t, ka, ke);
      const ft = Bateman.f(t, ka, ke);
      if (ft === 0) break;

      const next = t - (Ft - x) / ft;
      if (Math.abs(next - t) < tol) return Math.max(0, next);
      t = Math.max(0, next);
    }

    return t;
  }
  const epsilon = 1e-10;
  export function solveKa(
    tEnd: number, // The duration we want
    target: number, // Some fraction
    ke: number, // Known ke
    tol = 1e-9,
    maxIter = 500,
  ): number {
    if (!(tEnd > 0)) return NaN;
    if (!(ke > 0)) return NaN;
    if (!(target > 0 && target < 1)) return NaN;

    // Even with infinitely fast absorption, the CDF approaches:
    // maxTarget = 1 - exp(-ke * tEnd)
    const maxTarget = 1 - Math.exp(-ke * tEnd);
    if (target >= maxTarget) {
      if (Math.abs(target - maxTarget) < tol) return Infinity;
      return NaN;
    }

    const g = (ka: number) => F(tEnd, ka, ke) - target;

    // Start with bounds strictly away from ka = ke
    let lo = 1e-12;
    let hi = Math.max(1 / tEnd, ke * 2, 1e-3);

    // If hi is somehow too close to ke, nudge it upward
    if (Math.abs(hi - ke) < epsilon) hi = ke * 2 + epsilon;

    let gHi = g(hi);

    // Expand until we bracket the root
    let guard = 0;
    while (gHi < 0 && guard < 200) {
      hi *= 2;
      if (Math.abs(hi - ke) < epsilon) hi += epsilon;
      gHi = g(hi);
      guard++;
    }

    if (gHi < 0) return NaN;

    // Bisection
    for (let i = 0; i < maxIter; i++) {
      const mid = 0.5 * (lo + hi);
      const gMid = g(mid);

      if (Math.abs(gMid) < tol) return mid;

      if (gMid > 0) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    return 0.5 * (lo + hi);
  }
}
