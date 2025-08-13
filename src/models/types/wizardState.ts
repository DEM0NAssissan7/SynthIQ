import type { Deserializer, Serializer } from "./types";

export enum WizardPage {
  Intro,
  Select,
  Hub,
  Meal,
  Insulin,
  FinalBG,
  Edit,
}

type StateNameKey = [WizardPage, string];
const stateNames: StateNameKey[] = [
  [WizardPage.Intro, "intro"],
  [WizardPage.Select, "select"],
  [WizardPage.Hub, "hub"],
  [WizardPage.Meal, "meal"],
  [WizardPage.Insulin, "insulin"],
  [WizardPage.FinalBG, "finalbg"],
  [WizardPage.Edit, "edit"],
];

// Serialization
export const serializeWizardPage: Serializer<WizardPage> = (
  state: WizardPage
) => {
  for (let a of stateNames) if (a[0] === state) return a[1];
  throw new Error(`Cannot find name for state ${state}`);
};

export const deserializeWizardPage: Deserializer<WizardPage> = (s: string) => {
  for (let a of stateNames) if (a[1] === s) return a[0];
  throw new Error(`Cannot find state for name ${s}`);
};
