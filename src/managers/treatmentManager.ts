/**
 * This is a general manager that ties together all the
 * subsystems into one singular source of truth
 */

import { markGlucose } from "../lib/healthMonitor";
import RemoteTreatments from "../lib/remote/treatments";
import { ActivityManager } from "./activityManager";
import { RescueVariantManager } from "./rescueVariantManager";
import WizardManager from "./wizardManager";

export namespace TreatmentManager {
  export function insulin(
    amount: number,
    variant: string,
    BG: number,
    isBolus: boolean = true,
    timestamp = new Date()
  ) {
    if (isBolus) WizardManager.markInsulin(amount, BG, variant);
    RemoteTreatments.markInsulin(amount, timestamp, variant);
  }
  export function glucose(
    amount: number,
    variant: string,
    timestamp = new Date()
  ) {
    const v = RescueVariantManager.getVariant(variant);
    markGlucose(amount, v, timestamp);
    WizardManager.markGlucose(amount, v);
    ActivityManager.markGlucose(amount, v);
    RemoteTreatments.markGlucose(amount, new Date(), variant);
  }
}
