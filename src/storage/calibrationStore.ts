import StorageNode from "./storageNode";

export const defaultBodyWeight = 163; // This is just my body weight in lbs
export namespace CalibrationStore {
  const node = new StorageNode("calibration");

  export const bodyWeight = node.add("bodyWeight", defaultBodyWeight);

  // General Profile
  export const carbsEffect = node.add("carbsEffect", 5);
  export const proteinEffect = node.add("proteinEffect", 1);
}
