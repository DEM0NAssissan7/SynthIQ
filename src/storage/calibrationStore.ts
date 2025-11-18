import StorageNode from "./storageNode";

export const defaultBodyWeight = 155;
export namespace CalibrationStore {
  const node = new StorageNode("calibration");

  export const basalEffect = node.add("basalEffect", 1.5);
  export const bodyWeight = node.add("bodyWeight", defaultBodyWeight); // This is just my body weight

  // General Profile
  export const carbsEffect = node.add("carbsEffect", 5);
  export const proteinEffect = node.add("proteinEffect", 1);
}
