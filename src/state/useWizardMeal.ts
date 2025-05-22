import { wizardStorage } from "../storage/wizardStore";
import useMealState from "./useMealState";

export function useWizardMealState() {
  return useMealState(wizardStorage.get("meal"));
}
