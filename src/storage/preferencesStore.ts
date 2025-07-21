import StorageNode from "../lib/storageNode";
import { profile } from "./metaProfileStore";

const preferencesStore = new StorageNode("preferences");
export default preferencesStore;

preferencesStore.add("maxSessionLength", 8);
preferencesStore.add("endingHours", 1);
preferencesStore.add("lowBG", 70);
preferencesStore.add("dangerBG", 55);

preferencesStore.add("highBG", 125);

preferencesStore.add("insulinStepSize", 1);
preferencesStore.add("timeStepSize", 5);

preferencesStore.add("sessionHalfLife", 3);
preferencesStore.add("maxSessionLife", 14);

preferencesStore.add("glucoseEffect", 10);
// Update profile upon glucose effect changing
preferencesStore.subscribe(
  "glucoseEffect",
  (a: number) => (profile.glucose.effect = a)
);
