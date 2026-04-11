export namespace Bateman {
  export function f(t: number, ka: number, ke: number) {
    if (t <= 0) return 0;
    const A = (ka * ke) / (ke - ka);
    return A * (Math.exp(-ka * t) - Math.exp(-ke * t));
  }

  export function F(t: number, ka: number, ke: number) {
    if (t <= 0) return 0;
    const A = (ka * ke) / (ke - ka);
    return A * ((1 - Math.exp(-ka * t)) / ka - (1 - Math.exp(-ke * t)) / ke);
  }

  export function area(a: number, b: number, ka: number, ke: number) {
    return F(b, ka, ke) - F(a, ka, ke);
  }
}
