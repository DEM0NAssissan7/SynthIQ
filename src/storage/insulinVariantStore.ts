import Serialization from "../lib/serialization";
import { InsulinVariant } from "../models/types/insulinVariant";
import StorageNode from "./storageNode";

export namespace InsulinVariantStore {
  const node = new StorageNode("insulinVariant");

  export const variants = node.add(
    "variants",
    [
      new InsulinVariant("Insulin", 50, 28, 0.5, 0.7),
      new InsulinVariant("Basal", 1.5, 56, 0.01, 0.7),
    ],
    Serialization.getArraySerializer(InsulinVariant.serialize),
    Serialization.getArrayDeserializer(InsulinVariant.deserialize),
  );
  export const basalVariant = node.add("basalVariant", "Basal");
}
