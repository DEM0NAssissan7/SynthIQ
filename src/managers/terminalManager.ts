import { basalInsulinVariant } from "../lib/basal";
import { RemoteInbox } from "../lib/remote/inbox";
import Glucose from "../models/events/glucose";
import Insulin from "../models/events/insulin";
import type { InsulinVariant } from "../models/types/insulinVariant";
import { MasterState } from "../models/types/masterState";
import type { RescueVariant } from "../models/types/rescueVariant";
import { PreferencesStore } from "../storage/preferencesStore";
import { PrivateStore } from "../storage/privateStore";
import { TreatmentManager } from "./treatmentManager";

export namespace TerminalManager {
  function isTerminal() {
    return PrivateStore.masterState.value === MasterState.TERMINAL;
  }
  function isMaster() {
    return PrivateStore.masterState.value === MasterState.MASTER;
  }
  export async function insulin(
    amount: number,
    variant: InsulinVariant,
    isBolus: boolean,
    timestamp = new Date()
  ) {
    if (!isTerminal()) return;
    const insulin = new Insulin(amount, timestamp, variant);
    await RemoteInbox.insulin(insulin, isBolus);
  }
  export async function glucose(
    amount: number,
    variant: RescueVariant,
    timestamp = new Date()
  ) {
    if (!isTerminal()) return;
    const glucose = new Glucose(amount, timestamp, variant);
    await RemoteInbox.glucose(glucose);
  }
  export async function basal(amount: number, timestamp: Date) {
    const insulin = new Insulin(amount, timestamp, basalInsulinVariant);
    await RemoteInbox.basal(insulin);
  }

  // This is for the master only
  export async function applyMail() {
    if (!isMaster()) return;
    const mail = await RemoteInbox.getMail();
    if (!mail) return;
    console.log(mail);
    mail.forEach((m) => {
      // Insulin
      const insulin = m.insulin;
      if (insulin) {
        if (insulin.variant.name === basalInsulinVariant.name) {
          TreatmentManager.basal(insulin.value, insulin.timestamp);
        } else {
          TreatmentManager.insulin(
            insulin.value,
            insulin.variant.name,
            m.BG ?? PreferencesStore.targetBG.value,
            m.isSessionApplicable,
            insulin.timestamp
          );
        }
      }

      // Glucose
      const glucose = m.glucose;
      if (glucose) {
        TreatmentManager.glucose(
          glucose.value,
          glucose.variant.name,
          glucose.timestamp
        );
      }
    });

    await RemoteInbox.clear();
  }
}
