import Serialization from "../lib/serialization";
import { InsulinVariant } from "../models/types/insulinVariant";
import StorageNode from "./storageNode";

export namespace InsulinVariantStore {
  const node = new StorageNode("insulinVariant");

  export const variants = node.add(
    "variants",
    [new InsulinVariant("Insulin", 7, 50)],
    Serialization.getArraySerializer(InsulinVariant.serialize),
    Serialization.getArrayDeserializer(InsulinVariant.deserialize)
  );
}
