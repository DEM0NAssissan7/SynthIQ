![alt text](public/favicon.png)

# Disclaimer

DO NOT use SynthIQ for any medical decisions. This app is for educational purposes ONLY.

# SynthIQ

Built upon React + Typescript and using Bootstrap as the theming engine, this application combines beautiful visuals, intuitive UI, and intelligent predictions.

## License and Philosophy

This software was created as a personal tool for managing diabetes. I share it freely in the hope that it helps others learn from their disease. It is licensed under **GPLv3** to ensure it remains open and cannot be privatized.

I do not accept donations or profit from this work — I simply ask that if it helps you, **pay it forward** by contributing, whether it be through:

- Submitting bug reports
- Opening a pull request
- Simply spreading the word

Diabetes is hard enough. No one should profit at the expense of those who suffer from it.

# Sources
Food Database - https://www.nutritionix.com/

# App Integration

## m3 glucose predictor

`src/lib/glucosePrediction.ts` now contains the **m3 model predictor** — a
42-feature gradient-boosting model (sklearn `HistGradientBoostingRegressor`)
that predicts CGM glucose at 15/30/60-minute horizons, alongside the original
heuristic predictor, which is preserved verbatim as a fallback.

- **Model asset:** `public/models/predictor_60m.bin.gz` — self-describing
  binary format v1 (40-byte header with band scale + holdout stats; per-model
  24-byte header; 16 bytes/tree node). Child indices are tree-local; leaf
  values are i16-quantized and pre-shrunk, so inference is
  `pred = baseline + Σ tree(x)` with no learning-rate multiplier.
- **Loading:** `loadGlucosePredictionModel()` fetches the asset from
  `/models/predictor_60m.bin.gz` (gzip auto-detected by magic bytes, so
  raw/gzipped `ArrayBuffer` inputs also work). Loading is idempotent and
  cached per model tick.
- **Dispatch:** `getPredictedGlucose()` uses the m3 model when it is loaded
  (`hasLoadedModel()`) and falls back to the legacy heuristic otherwise.
  The public interface (`getPredictedGlucose`,
  `getPredictedGlucoseAccuracy`, `getRefReading`) is unchanged, so no other
  app files were modified for the switch.
- **Holdout metrics** (embedded in the model header): MAE 9.5 mg/dL,
  median 7.6 mg/dL, coverage 88.7%, band width 28.2 mg/dL at the 60-minute
  horizon.
- **Parity:** feature construction (all 42 features) and tree inference were
  verified byte-for-byte against the Python trainer; end-to-end predictions
  match sklearn within i16 leaf quantization (~10⁻³).
- **Regenerating the model:** run
  `nightscout-analysis/scripts/export_model_bin.py` (read-only Nightscout
  access) and copy the gzipped output to `public/models/predictor_60m.bin.gz`,
  then rebuild (`npm run build` regenerates `src/bundledHtml.ts`).
- The predictor emits point estimates and a prediction band only — it gives
  **no dosing advice**.