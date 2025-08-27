import StorageNode from "./storageNode";
import Session from "../models/session";
import Meal from "../models/events/meal";
import {
  deserializeWizardPage,
  serializeWizardPage,
  WizardPage,
} from "../models/types/wizardPage";
import MealTemplate from "../models/mealTemplate";
import Serialization from "../lib/serialization";

export namespace WizardStore {
  const node = new StorageNode("wizard");

  // Templates
  export const templates = node.add<MealTemplate[]>(
    "templates",
    [],
    Serialization.getArraySerializer(MealTemplate.serialize),
    Serialization.getArrayDeserializer(MealTemplate.deserialize)
  );
  export const template = node.add<MealTemplate>(
    "currentTemplate",
    new MealTemplate(""),
    MealTemplate.serialize,
    MealTemplate.deserialize
  );

  // Page
  export const page = node.add<WizardPage>(
    "page",
    WizardPage.Select,
    serializeWizardPage,
    deserializeWizardPage
  );

  // State tracking for insulin page
  export const isBolus = node.add("isBolus", false);

  // Session
  export const session = node.add<Session>(
    "session",
    new Session(),
    Session.serialize,
    Session.deserialize
  );
  {
    const callback = () => session.write();
    session.subscribe((value: Session) => {
      value.unsubscribe(callback); // Unsubscribe if we already subscribed
      value.subscribe(callback);
    });
    session.notify(); // Notify to push the new subscriber handler
  }

  export const meal = node.add<Meal>(
    "meal",
    new Meal(new Date()),
    Meal.serialize,
    Meal.deserialize
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
}
