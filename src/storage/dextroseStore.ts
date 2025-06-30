import StorageNode from "../lib/storageNode";

const dextroseStore = new StorageNode("dextrose");
// desired concentration
dextroseStore.add("concentrationGlucose", 1);
dextroseStore.add("concentrationVolume", 3);

// glucose in powder
dextroseStore.add("powderGlucoseContent", 1);
dextroseStore.add("powderMassContent", 1);

dextroseStore.add("totalSolution", 300);
export default dextroseStore;
