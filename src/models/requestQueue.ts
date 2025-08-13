import { genUUID, type UUID } from "../lib/util";
import RequestType, {
  parseRequestType,
  stringifyRequestType,
} from "./types/requestType";
import type { Deserializer, Serializer } from "./types/types";

export default class RequestQueue {
  type: RequestType;
  api: string; // URL stub
  timestamp: Date;
  uuid: UUID;
  payload: any = {};
  constructor(type: RequestType, api: string, payload?: any, timestamp?: Date) {
    this.type = type;
    this.api = api;
    this.timestamp = timestamp || new Date();
    this.uuid = genUUID();
    this.payload = payload || {};
  }
  static serialize: Serializer<RequestQueue> = (q: RequestQueue) => {
    return JSON.stringify({
      type: stringifyRequestType(q.type),
      api: q.api,
      payload: q.payload,
      uuid: q.uuid,
      timestamp: q.timestamp,
    });
  };
  static deserialize: Deserializer<RequestQueue> = (s: string) => {
    const o = JSON.parse(s);
    const type = parseRequestType(o.type);
    const timestamp = new Date(o.timestamp);
    const q = new RequestQueue(type, o.api, o.payload, timestamp);
    q.uuid = o.uuid;
    return q;
  };
}
