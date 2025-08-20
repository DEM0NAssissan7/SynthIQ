import type { Deserializer, Serializer } from "./types";

export enum ActivityPage {
  Select,
  Start,
  End,
}

type StateNameKey = [ActivityPage, string];
const stateNames: StateNameKey[] = [
  [ActivityPage.Select, "select"],
  [ActivityPage.Start, "start"],
  [ActivityPage.End, "end"],
];

// Serialization
export const serializeActivityPage: Serializer<ActivityPage> = (
  state: ActivityPage
) => {
  for (let a of stateNames) if (a[0] === state) return a[1];
  throw new Error(`Cannot find name for state ${state}`);
};

export const deserializeActivityPage: Deserializer<ActivityPage> = (
  s: string
) => {
  for (let a of stateNames) if (a[1] === s) return a[0];
  throw new Error(`Cannot find state for name ${s}`);
};
