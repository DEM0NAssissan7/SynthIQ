import Serialization from "../lib/serialization";
import { InsulinExpiration } from "../models/insulinExpiration";
import StorageNode from "./storageNode";

export namespace ExpirationStore {
  const node = new StorageNode("expiration");
  export const expirations = node.add(
    "expirations",
    [],
    Serialization.getArraySerializer(InsulinExpiration.serialize),
    Serialization.getArrayDeserializer(InsulinExpiration.deserialize)
  );
}
