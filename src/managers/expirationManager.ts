import { InsulinExpiration } from "../models/insulinExpiration";
import type { InsulinVariant } from "../models/types/insulinVariant";
import { ExpirationStore } from "../storage/expirationStore";
import { PrivateStore } from "../storage/privateStore";

export namespace InsulinExpirationManager {
  export function replacementDue() {
    const expirations = ExpirationStore.expirations.value;
    for (let e of expirations) {
      if (e.daysLeft <= 0) return e;
    }
    return false;
  }
  export function get(fullName: string) {
    const expirations = ExpirationStore.expirations.value;
    for (let e of expirations) {
      if (e.fullName === fullName) return e;
    }
    return undefined;
  }
  export function add(label: string, variant: InsulinVariant, openDate: Date) {
    const e = new InsulinExpiration(label, variant, openDate);
    if (get(e.fullName))
      throw new Error(
        `Cannot add expirer - expirer '${e.fullName}' already exists`
      );
    ExpirationStore.expirations.value = [
      ...ExpirationStore.expirations.value,
      e,
    ];
    if (PrivateStore.debugLogs.value)
      console.log(`Added expirer '${e.fullName}'`);
  }
  export function remove(fullName: string) {
    ExpirationStore.expirations.value =
      ExpirationStore.expirations.value.filter((e) => e.fullName !== fullName);
    if (PrivateStore.debugLogs.value)
      console.log(`Removed expirer ${fullName}`);
  }
  export function renew(e: InsulinExpiration) {
    const victim = get(e.fullName);
    if (!victim)
      throw new Error(`Cannot renew expirer - '${e.fullName}' does not exist`);
    victim.openDate = new Date();
    ExpirationStore.expirations.write();
  }
}
