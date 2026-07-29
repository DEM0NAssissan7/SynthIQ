import Serialization from "../lib/serialization";
import { InsulinVariant } from "../models/types/insulinVariant";
import StorageNode from "./storageNode";

export const DEFAULT_INSULIN_VARIANTS = [
  new InsulinVariant("Insulin", 50, 28, 0.5, 0.7),
  new InsulinVariant("Basal", 1.5, 56, 0.01, 0.7),
];

export namespace InsulinVariantStore {
  const node = new StorageNode("insulinVariant");

  export const variants = node.add(
    "variants",
    DEFAULT_INSULIN_VARIANTS,
    Serialization.getArraySerializer(InsulinVariant.serialize),
    Serialization.getArrayDeserializer(InsulinVariant.deserialize),
  );
  export const basalVariant = node.add("basalVariant", "Basal");
}
