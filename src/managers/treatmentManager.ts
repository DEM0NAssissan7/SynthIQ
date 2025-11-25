/**
 * This is a general manager that ties together all the
 * subsystems into one singular source of truth
 */

import { markBasal } from "../lib/basal";
import { markGlucose } from "../lib/healthMonitor";
import RemoteTreatments from "../lib/remote/treatments";
import { MasterState } from "../models/types/masterState";
import { PrivateStore } from "../storage/privateStore";
import { ActivityManager } from "./activityManager";
import { InsulinVariantManager } from "./insulinVariantManager";
import { RescueVariantManager } from "./rescueVariantManager";
import { TerminalManager } from "./terminalManager";
import WizardManager from "./wizardManager";

export namespace TreatmentManager {
  export function insulin(
    amount: number,
    variant: string,
    BG: number,
    isBolus: boolean = true,
    timestamp = new Date()
  ) {
    const v = InsulinVariantManager.getVariant(variant);

    if (PrivateStore.masterState.value === MasterState.TERMINAL) {
      TerminalManager.insulin(amount, v, isBolus);
      return;
    }

    if (isBolus) WizardManager.markInsulin(amount, BG, variant);
    RemoteTreatments.markInsulin(amount, timestamp, variant);
  }
  export function glucose(
    amount: number,
    variant: string,
    timestamp = new Date()
  ) {
    const v = RescueVariantManager.getVariant(variant);
    if (PrivateStore.masterState.value === MasterState.TERMINAL) {
      TerminalManager.glucose(amount, v);
      return;
    }

    markGlucose(amount, v, timestamp);
    WizardManager.markGlucose(amount, v);
    ActivityManager.markGlucose(amount, v);
    RemoteTreatments.markGlucose(amount, timestamp, variant);
  }
  export function basal(amount: number, timestamp = new Date()) {
    if (PrivateStore.masterState.value === MasterState.TERMINAL) {
      TerminalManager.basal(amount, timestamp);
      return;
    }

    markBasal(amount, timestamp);
  }
}
