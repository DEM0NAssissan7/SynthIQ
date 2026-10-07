import Unit from "../../models/unit";
import { BackendStore } from "../../storage/backendStore";
import { convertDimensions } from "../util";

interface Treatment {
  timestamp: Date;
  variant: {
    duration: number; // In Unit.Time (specified)
  };
}
export function hasTreatmentOverlap(
  timestamp: Date,
  treatment: Treatment,
  durationUnits: Unit.Time,
  applyCGMDelay = true,
): boolean {
  // Conditional on r0<t<r0+rd
  const CGMDelay = BackendStore.cgmDelay.value; // CGM delay in minutes
  const t = timestamp.getTime();
  const r0 =
    treatment.timestamp.getTime() +
    (applyCGMDelay
      ? CGMDelay * convertDimensions(Unit.Time.Minute, Unit.Time.Millis)
      : 0);
  const rd =
    treatment.variant.duration *
    convertDimensions(durationUnits, Unit.Time.Millis);
  return t > r0 && t < r0 + rd;
}
