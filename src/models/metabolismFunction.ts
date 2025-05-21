import metaProfile from "../storage/metaProfileStore";
import MetaFunctions, { metaKernel } from "./metaFunctions";

// Metabolism Simulations
export const defaultGI = 15;

export default class MetabolismFunction {
  /** Carbohydrates tend to follow a parabolic curve that peaks and falls off
   * This function attempts to mimic that behavior
   */
  static carbs(t: number, carbs: number, GI: number): number {
    return metaKernel(
      t,
      carbs * metaProfile.get("ecarbs"),
      metaProfile.get("ncarbs"),
      metaProfile.get("pcarbs") * (defaultGI / GI),
      MetaFunctions.G
    );
  }
  /** Protein seems to have a continuous, steady release
   * that gets longer the more protein injected.
   * Protein's blood sugar increase rate doesn't seem to increase at all,
   * only the duration it happens for. That's why we extend the duration on this too.
   */
  static protein(t: number, protein: number) {
    return metaKernel(
      t,
      protein * metaProfile.get("eprotein"),
      metaProfile.get("nprotein"),
      metaProfile.get("cprotein") /* The minimum time protein can take */ +
        protein * metaProfile.get("pprotein"), // Plateu (hour / gram)
      MetaFunctions.C
    );
  }
  /** Insulin is best modeled by a half life decaying function */
  static insulin(t: number, units: number) {
    return metaKernel(
      t,
      -units * metaProfile.get("einsulin"),
      metaProfile.get("ninsulin"),
      metaProfile.get("pinsulin"),
      MetaFunctions.H // Half life decay
    );
  }
  /** Glucose is released very quickly in the blood and quickly tapers off.
   * This has not yet been tested.
   */
  static glucose(t: number, grams: number) {
    return metaKernel(
      t,
      grams * metaProfile.get("ecarbs"),
      metaProfile.get("nglucose"),
      metaProfile.get("pglucose"),
      MetaFunctions.G
    );
  }
}
