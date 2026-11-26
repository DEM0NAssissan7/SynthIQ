import StorageNode from "./storageNode";
import Meal from "../models/events/meal";
import { Activity } from "../models/events/activity";
import { InjectionPurpose, toInjectionPurpose } from "../models/events/insulin";

export namespace EntryStore {
  const node = new StorageNode("entry");

  // State tracking for insulin page
  export const injectionPurpose = node.add(
    "injectionPurpose",
    InjectionPurpose.Nominal,
    (p) => JSON.stringify(p),
    (o) => toInjectionPurpose(JSON.parse(o)),
  );

  // Active stuff
  export const meal = node.add<Meal>(
    "meal",
    new Meal(new Date(), ""),
    Meal.serialize,
    Meal.deserialize,
  );
  {
    const callback = () => {
      meal.write();
    };
    meal.subscribe((value: Meal) => {
      value.unsubscribe(callback);
      value.subscribe(callback);
    });
    meal.notify();
  }
  export const activityName = node.add("activityName", "");
  export const activity = node.add<Activity>(
    "activity",
    new Activity("", new Date(), 0),
    Activity.serialize,
    Activity.deserialize,
  );
  export const activityIsActive = node.add("activityIsActive", false);
}
