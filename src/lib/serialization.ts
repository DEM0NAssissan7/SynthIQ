import type {
  Deserializer,
  JSONValue,
  Serializer,
} from "../models/types/types";

namespace Serialization {
  export function getArraySerializer<T>(
    serializer: Serializer<T>
  ): Serializer<T[]> {
    return (a) => {
      return a.map((b: any) => serializer(b));
    };
  }
  export function getArrayDeserializer<T>(
    deserializer: Deserializer<T>
  ): Deserializer<T[]> {
    return (o: JSONValue) => {
      if (Array.isArray(o)) return o.map((a: any) => deserializer(a));
      return [];
    };
  }
}

export default Serialization;
