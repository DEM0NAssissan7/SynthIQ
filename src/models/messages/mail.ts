import Activity from "../events/activity";
import Glucose from "../events/glucose";
import Insulin from "../events/insulin";
import Meal from "../events/meal";
import type { Serializer, Deserializer } from "../types/types";

export class Mail {
  insulin: Insulin | null = null;
  glucose: Glucose | null = null;
  activity: Activity | null = null;
  meal: Meal | null = null;
  BG: number | null = null;
  isSessionApplicable = false;
  static serialize: Serializer<Mail> = (m: Mail) => {
    return {
      insulin: m.insulin ? Insulin.serialize(m.insulin) : null,
      glucose: m.glucose ? Glucose.serialize(m.glucose) : null,
      activity: m.activity ? Activity.serialize(m.activity) : null,
      meal: m.meal ? Meal.serialize(m.meal) : null,
      BG: m.BG,
      isSessionApplicable: m.isSessionApplicable,
    };
  };
  static deserialize: Deserializer<Mail> = (o: any) => {
    const insulin = o.insulin ? Insulin.deserialize(o.insulin) : null;
    const glucose = o.glucose ? Glucose.deserialize(o.glucose) : null;
    const activity = o.activity ? Activity.deserialize(o.activity) : null;
    const meal = o.meal ? Meal.deserialize(o.meal) : null;

    let mail = new Mail();
    mail.insulin = insulin;
    mail.glucose = glucose;
    mail.activity = activity;
    mail.meal = meal;
    mail.BG = o.BG;
    mail.isSessionApplicable = o.isSessionApplicable;
    return mail;
  };
}
