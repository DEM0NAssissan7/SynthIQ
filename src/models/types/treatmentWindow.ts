import Glucose from "../events/glucose";
import Insulin from "../events/insulin";
import Snapshot from "../snapshot";

export interface TreatmentWindow {
  snapshot: Snapshot;
  initialBG: number;
  startTime: Date;
  insulins: Insulin[];
  glucoses: Glucose[];
  finalBG: number;
  endTime: Date;
  length: number;
}

export function windowDeepCopy(window: TreatmentWindow): TreatmentWindow {
  return {
    snapshot: Snapshot.deserialize(Snapshot.serialize(window.snapshot)),
    initialBG: window.initialBG,
    startTime: new Date(window.startTime),
    insulins: window.insulins.map((i) =>
      Insulin.deserialize(Insulin.serialize(i)),
    ),
    glucoses: window.glucoses.map((g) =>
      Glucose.deserialize(Glucose.serialize(g)),
    ),
    finalBG: window.finalBG,
    endTime: new Date(window.endTime),
    length: window.length,
  };
}
