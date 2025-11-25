import type Activity from "../events/activity";
import type Glucose from "../events/glucose";
import type Insulin from "../events/insulin";
import type Meal from "../events/meal";
import type { Serializer, Deserializer } from "../types/types";
import { Mail } from "./mail";

export class Inbox {
  mail: Mail[] = [];
  addMail(message: Mail) {
    this.mail.push(message);
  }
  get treatments() {
    let insulins: Insulin[] = [];
    let sessionInsulins: Insulin[] = [];
    let glucoses: Glucose[] = [];
    let activities: Activity[] = [];
    let meals: Meal[] = [];

    this.mail.forEach((m) => {
      if (m.insulin) {
        if (m.isSessionApplicable) sessionInsulins.push(m.insulin);
        else insulins.push(m.insulin);
      }
      if (m.glucose) glucoses.push(m.glucose);
      if (m.activity) activities.push(m.activity);
      if (m.meal) meals.push(m.meal);
    });

    return {
      insulins,
      sessionInsulins,
      glucoses,
      activities,
      meals,
    };
  }
  static serialize: Serializer<Inbox> = (i: Inbox) => {
    return i.mail.map((m) => Mail.serialize(m));
  };
  static deserialize: Deserializer<Inbox> = (o: any) => {
    let inbox = new Inbox();
    const mail = o.map((a: any) => Mail.deserialize(a));
    inbox.mail = mail;
    return inbox;
  };
}
