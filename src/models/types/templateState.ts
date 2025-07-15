export enum TemplateState {
  Select,
  Hub,
  Meal,
  Insulin,
  Glucose,
  FinalBG,
  Edit,
}

type StateNameKey = [TemplateState, string];
const stateNames: StateNameKey[] = [
  [TemplateState.Select, "select"],
  [TemplateState.Hub, "hub"],
  [TemplateState.Meal, "meal"],
  [TemplateState.Insulin, "insulin"],
  [TemplateState.Glucose, "glucose"],
  [TemplateState.FinalBG, "finalbg"],
  [TemplateState.Edit, "edit"],
];

// Serialization
export function getStateName(state: TemplateState): string {
  for (let a of stateNames) if (a[0] === state) return a[1];
  throw new Error(`Cannot find name for state ${state}`);
}
export function getStateFromName(name: string): TemplateState {
  for (let a of stateNames) if (a[1] === name) return a[0];
  throw new Error(`Cannot find state for name ${name}`);
}
