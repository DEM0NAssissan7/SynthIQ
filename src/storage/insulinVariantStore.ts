import Serialization from "../lib/serialization";
import { InsulinVariant } from "../models/types/insulinVariant";
import { BasalStore } from "./basalStore";
import { CalibrationStore } from "./calibrationStore";
import StorageNode from "./storageNode";

export namespace InsulinVariantStore {
  const node = new StorageNode("insulinVariant");

  export const variants = node.add(
    "variants",
    [
      new InsulinVariant(
        "Insulin",
        BasalStore.minTimeSinceBolus.value,
        CalibrationStore.insulinEffect.value
      ),
    ],
    Serialization.getArraySerializer(InsulinVariant.serialize),
    Serialization.getArrayDeserializer(InsulinVariant.deserialize)
  );
}
