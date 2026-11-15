/**
 * r1Core.ts — pure-TS inference for the r1 residual-error model
 * (GRU(8->128 x2, eval) + MLP(160->128 GELU 64 GELU 1)).
 *
 * Weights come from weights.ts (generated verbatim from models/r1/r1.pt via
 * scripts/export_weights.py). Math is f64 (PyTorch ran f32) — the divergence
 * from the Python/PyTorch reference is < 1e-3 mg/dL (verified on the full
 * chronological test set: max 4.3e-5 mg/dL on the 1318-anchor test set).
 *
 * Deployment rules (r1 training requirements, applied here):
 *  - CAPPED: the residual is clipped to +-caps[h], the largest |residual|
 *    seen in training at each horizon (guards against wild outputs on
 *    inputs barely seen in training, e.g. overnight NPH or a new insulin).
 *  - SKIPPED: horizons in skipHorizons (currently +5 min) return null — the
 *    caller must use the base prediction there.
 *  - VERSION LOCK: weights.ts carries base_version.ts_sha256 (hash of the
 *    locked base-predictor sources). The app additionally runs a behavioral
 *    canary (see glucosePrediction.isBaseVersionValid) — any change to the
 *    base predictor invalidates r1 and the correction is turned off.
 */

import type { R1Weights } from "./weights";
import { r1Weights } from "./weights";

const SQRT2 = Math.SQRT2;

/** erf, Abramowitz-Stegun 7.1.26 (|rel err| < 1.5e-7) — matches torch GELU to ~1e-7. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return sign * y;
}

/** PyTorch nn.GELU (default: exact erf form). */
function gelu(x: number): number {
  return 0.5 * x * (1 + erf(x / SQRT2));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** One GRU layer, one timestep. h: H-vector (reused in place). x: C-vector at offset. */
function gruStep(
  W: R1Weights,
  layer: number,
  x: ArrayLike<number>,
  xOff: number,
  h: Float64Array,
): void {
  const H = W.gru_hh_w[layer][0].length; // hidden size (columns), not 3*H rows
  const C = W.gru_ih_w[layer][0].length;
  const ihW = W.gru_ih_w[layer]; // [3H][C]
  const ihB = W.gru_ih_b[layer];
  const hhW = W.gru_hh_w[layer]; // [3H][H]
  const hhB = W.gru_hh_b[layer];
  const z = new Float64Array(H);
  const r = new Float64Array(H);
  const c = new Float64Array(H);
  for (let i = 0; i < H; i++) {
    // PyTorch GRU row layout: block 0 = reset (r), block 1 = zone (z), block 2 = new (n)
    let dr = ihB[i];
    let dz = ihB[i + H];
    let dc = ihB[i + 2 * H];
    for (let j = 0; j < C; j++) {
      const xv = x[xOff + j];
      dr += ihW[i][j] * xv;
      dz += ihW[i + H][j] * xv;
      dc += ihW[i + 2 * H][j] * xv;
    }
    let rr = hhB[i];
    let rz = hhB[i + H];
    let rc = hhB[i + 2 * H];
    for (let j = 0; j < H; j++) {
      const hv = h[j];
      rr += hhW[i][j] * hv;
      rz += hhW[i + H][j] * hv;
      rc += hhW[i + 2 * H][j] * hv;
    }
    // PyTorch GRU: r,z from their blocks; candidate is tanh(x + r * h) (reset-gated)
    z[i] = sigmoid(dz + rz);
    r[i] = sigmoid(dr + rr);
    c[i] = Math.tanh(dc + r[i] * rc);
  }
  for (let i = 0; i < H; i++) h[i] = (1 - z[i]) * c[i] + z[i] * h[i];
}

function mlpLayer(w: number[][], b: number[], x: number[]): number[] {
  const out = new Float64Array(w.length);
  for (let i = 0; i < w.length; i++) {
    let s = b[i];
    const row = w[i];
    for (let j = 0; j < row.length; j++) s += row[j] * x[j];
    out[i] = s;
  }
  return Array.from(out);
}

/** Horizon encoding (identical to r1_train.horfeat): [h/120, sin, cos, (h/120)^2]. */
function horfeat(h: number): number[] {
  const x = h / 120.0;
  return [x, Math.sin(2 * Math.PI * x), Math.cos(2 * Math.PI * x), x * x];
}

/**
 * Horizon-independent part of the model for one anchor: the GRU's final
 * hidden state followed by the normalized scalar features. Compute it once
 * and pass it to r1HeadResidual for each horizon.
 * seq: flat [36*8] (r1Features channel layout); scalRaw: 27 raw features
 *      (same order as r1_train.py).
 */
export function r1Encode(
  W: R1Weights,
  seq: number[],
  scalRaw: number[],
): Float64Array {
  const H = 128;
  const enc = new Float64Array(H + W.n_scal);

  // GRU over the sequence. PyTorch stacks layers: layer 1 consumes layer 0's
  // per-timestep hidden states (dropout=0.15 is layer-to-layer, off in eval).
  const h0 = new Float64Array(H);
  const h1 = new Float64Array(H);
  for (let t = 0; t < W.seq_len; t++) {
    gruStep(W, 0, seq, t * W.seq_ch, h0);
    gruStep(W, 1, h0, 0, h1);
  }
  for (let i = 0; i < H; i++) enc[i] = h1[i];

  // scal normalization (train-set stats)
  for (let i = 0; i < W.n_scal; i++)
    enc[H + i] = (scalRaw[i] - W.smean[i]) / W.sstd[i];
  return enc;
}

/**
 * Raw r1 residual (mg/dL) for one horizon, given an r1Encode output.
 * basePred: base algorithm's mg/dL prediction at this horizon (NaN if the
 * base returned none).
 */
export function r1HeadResidual(
  W: R1Weights,
  enc: Float64Array,
  basePred: number,
  horizon: number,
): number {
  const H = 128;
  const x = new Array<number>(H + W.n_scal + 4 + 1);
  for (let i = 0; i < H + W.n_scal; i++) x[i] = enc[i];
  const hf = horfeat(horizon);
  for (let i = 0; i < 4; i++) x[H + W.n_scal + i] = hf[i];
  x[H + W.n_scal + 4] = Number.isNaN(basePred) ? 0 : basePred / 100.0;

  let y = mlpLayer(W.mlp_w[0], W.mlp_b[0], x);
  for (let i = 0; i < y.length; i++) y[i] = gelu(y[i]);
  y = mlpLayer(W.mlp_w[1], W.mlp_b[1], y);
  for (let i = 0; i < y.length; i++) y[i] = gelu(y[i]);
  y = mlpLayer(W.mlp_w[2], W.mlp_b[2], y);
  return y[0];
}

/** Raw r1 residual (mg/dL) for one (anchor, horizon); r1Encode + r1HeadResidual. */
export function r1RawResidual(
  W: R1Weights,
  seq: number[],
  scalRaw: number[],
  basePred: number,
  horizon: number,
): number {
  return r1HeadResidual(W, r1Encode(W, seq, scalRaw), basePred, horizon);
}

/**
 * Deployed correction for one horizon from an r1Encode output
 * (requirements 3+4 applied):
 *  null  -> skip (horizon in skipHorizons, horizon unknown, or non-finite output)
 *  else  -> residual clipped to +-cap (largest |residual| seen in training)
 */
export function r1CorrectionFromEncoding(
  W: R1Weights,
  enc: Float64Array,
  basePred: number,
  horizon: number,
): number | null {
  const hpos = W.horizons.indexOf(horizon);
  if (hpos < 0 || W.skip_horizons.includes(horizon)) return null;
  const raw = r1HeadResidual(W, enc, basePred, horizon);
  if (!Number.isFinite(raw)) return null;
  const cap = W.caps[hpos];
  return Math.max(-cap, Math.min(cap, raw));
}

/** Deployed correction for one horizon (see r1CorrectionFromEncoding). */
export function r1Correction(
  W: R1Weights,
  seq: number[],
  scalRaw: number[],
  basePred: number,
  horizon: number,
): number | null {
  return r1CorrectionFromEncoding(
    W,
    r1Encode(W, seq, scalRaw),
    basePred,
    horizon,
  );
}

/** Convenience wrapper bound to the bundled weights. */
export function applyR1(
  seq: number[],
  scalRaw: number[],
  basePred: number,
  horizon: number,
): number | null {
  return r1Correction(r1Weights, seq, scalRaw, basePred, horizon);
}
