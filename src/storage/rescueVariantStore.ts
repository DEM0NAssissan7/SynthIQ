import Serialization from "../lib/serialization";
import { RescueVariant } from "../models/types/rescueVariant";
import StorageNode from "./storageNode";

export const DEFAULT_RESCUE_VARIANT = new RescueVariant("grams carbs", 30, 1, 5);

export namespace RescueVariantStore {
  const node = new StorageNode("rescueVariant");

  export const variants = node.add(
    "variants",
    [DEFAULT_RESCUE_VARIANT],
    Serialization.getArraySerializer(RescueVariant.serialize),
    Serialization.getArrayDeserializer(RescueVariant.deserialize)
  );
}
