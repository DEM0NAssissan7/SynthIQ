import type { Deserializer, Serializer } from "../models/types/types";

namespace Serialization {
  export function getArraySerializer<T>(
    serializer: Serializer<T>
  ): Serializer<T[]> {
    return (a) => {
      return JSON.stringify(a.map((b: any) => serializer(b)));
    };
  }
  export function getArrayDeserializer<T>(
    deserializer: Deserializer<T>
  ): Deserializer<T[]> {
    return (s) => {
      return JSON.parse(s).map((a: any) => deserializer(a));
    };
  }
}

export default Serialization;
