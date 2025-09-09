import StorageNode from "./storageNode";

export namespace PreferencesStore {
  const node = new StorageNode("preferences");

  export const maxSessionLength = node.add("maxSessionLength", 8);
  export const endingHours = node.add("endingHours", 1);
  export const targetBG = node.add("targetBG", 83);
  export const lowBG = node.add("lowBG", 70);
  export const dangerBG = node.add("dangerBG", 55);
  export const highBG = node.add("highBG", 125);
  export const insulinStepSize = node.add("insulinStepSize", 1);
  export const timeStepSize = node.add("timeStepSize", 5);
  export const sessionHalfLife = node.add("sessionHalfLife", 3);
  export const maxSessionLife = node.add("maxSessionLife", 30);
  export const overshootOffset = node.add("overshootOffset", 10);
  export const scaleByISF = node.add("scaleByISF", false);
}
