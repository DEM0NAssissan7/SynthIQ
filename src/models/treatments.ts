import Activity from "./types/activitySession";
import Glucose from "./events/glucose";
import Insulin from "./events/insulin";
import Meal from "./events/meal";

export type Treatments = {
  insulins: Insulin[];
  basals: unknown[];
  dextroses: Glucose[];
  activities: Activity[];
  meals: Meal[];
  sessions: unknown[];
};
