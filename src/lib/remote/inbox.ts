/**
 * Treatment inbox allows sessions to upload treatments without actually
 * needing to be masters. The master communicates with the inbox
 * to apply the treatments.
 */

import Activity from "../../models/events/activity";
import Glucose from "../../models/events/glucose";
import Insulin from "../../models/events/insulin";
import Meal from "../../models/events/meal";
import { Inbox } from "../../models/messages/inbox";
import { Mail } from "../../models/messages/mail";
import { PrivateStore } from "../../storage/privateStore";
import { basalInsulinVariant } from "../basal";
import { RemoteProfile } from "./profile";

export namespace RemoteInbox {
  export async function addMail(mail: Mail) {
    await RemoteProfile.modifyProfile((p: any) => {
      const inbox = p.inbox ? Inbox.deserialize(p.inbox) : new Inbox();
      inbox.addMail(mail);
      p.inbox = Inbox.serialize(inbox);
      if (PrivateStore.debugLogs.value) console.log(p.inbox);
      return p;
    });
  }
  export async function insulin(i: Insulin, isBolus: boolean) {
    let mail = new Mail();
    mail.insulin = i;
    mail.isSessionApplicable = isBolus;
    await addMail(mail);
  }
  export async function glucose(g: Glucose) {
    let mail = new Mail();
    mail.glucose = g;
    await addMail(mail);
  }
  export async function basal(i: Insulin) {
    i.variant = basalInsulinVariant;
    insulin(i, false);
  }
  export async function actvitiy(a: Activity) {
    let mail = new Mail();
    mail.activity = a;
    await addMail(mail);
  }
  export async function meal(m: Meal) {
    let mail = new Mail();
    mail.meal = m;
    await addMail(mail);
  }
  export async function getMail() {
    const profile = await RemoteProfile.getProfile();
    if (PrivateStore.debugLogs.value) console.log(profile);
    if (!profile.inbox) return null;
    return Inbox.deserialize(profile.inbox).mail;
  }
  export async function read() {
    const profile = await RemoteProfile.getProfile();
    const inbox = Inbox.deserialize(profile.inbox);
    return inbox.treatments;
  }
  export async function clear() {
    await RemoteProfile.modifyProfile((p: any) => {
      p.inbox = Inbox.serialize(new Inbox());
      return p;
    });
  }
}
