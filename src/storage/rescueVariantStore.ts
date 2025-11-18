import Serialization from "../lib/serialization";
import { RescueVariant } from "../models/types/rescueVariant";
import StorageNode from "./storageNode";

export namespace RescueVariantStore {
  const node = new StorageNode("rescueVariant");

  export const variants = node.add(
    "variants",
    [new RescueVariant("grams carbs", 30, 5)],
    Serialization.getArraySerializer(RescueVariant.serialize),
    Serialization.getArrayDeserializer(RescueVariant.deserialize)
  );
}
