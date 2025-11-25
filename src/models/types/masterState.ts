import type { Deserializer, Serializer } from "./types";

export enum MasterState {
  NONE,
  SLAVE,
  TERMINAL,
  MASTER,
}

export namespace MasterState {
  export const serialize: Serializer<MasterState> = (s: MasterState) => {
    return s.valueOf() as number;
  };
  export const deserialize: Deserializer<MasterState> = (i: number) => {
    return i as MasterState;
  };
}
