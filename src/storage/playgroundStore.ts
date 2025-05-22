import StorageNode from "../lib/storageNode";
import Meal from "../models/meal";

const playgroundStore = new StorageNode("playground");
export default playgroundStore;
playgroundStore.add("meal", new Meal(new Date()));
