import type Glucose from "../events/glucose";
import type Insulin from "../events/insulin";
import type Snapshot from "../snapshot";

export interface TreatmentWindow {
  snapshot: Snapshot;
  initialBG: number;
  insulins: Insulin[];
  glucoses: Glucose[];
  finalBG: number;
  length: number;
}
