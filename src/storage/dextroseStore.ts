import StorageNode from "../lib/storageNode";

export namespace DextroseStore {
  const node = new StorageNode("dextrose");

  export const concentrationGlucose = node.add("concentrationGlucose", 1);
  export const concentrationVolume = node.add("concentrationVolume", 3);
  export const powderGlucoseContent = node.add("powderGlucoseContent", 1);
  export const powderMassContent = node.add("powderMassContent", 1);
  export const totalSolution = node.add("totalSolution", 300);
}
