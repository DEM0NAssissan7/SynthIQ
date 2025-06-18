export enum WizardState {
  Intro, // Always at the beginning
  Meal,
  Insulin,
  MealConfirm,
  Summary,
  Glucose,
  Edit,
}

type StateNameKey = [WizardState, string];
const stateNames: StateNameKey[] = [
  [WizardState.Intro, "intro"],
  [WizardState.Meal, "meal"],
  [WizardState.Insulin, "insulin"],
  [WizardState.MealConfirm, "mealconfirm"],
  [WizardState.Summary, "summary"],
  [WizardState.Glucose, "glucose"],
  [WizardState.Edit, "edit"],
];

// Serialization
export function getStateName(state: WizardState): string {
  for (let a of stateNames) if (a[0] === state) return a[1];
  throw new Error(`Cannot find name for state ${state}`);
}
export function getStateFromName(name: string): WizardState {
  for (let a of stateNames) if (a[1] === name) return a[0];
  throw new Error(`Cannot find state for name ${name}`);
}
