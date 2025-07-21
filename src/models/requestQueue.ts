import { genUUID, type UUID } from "../lib/util";
import RequestType, {
  parseRequestType,
  stringifyRequestType,
} from "./types/requestType";

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
  static stringify(q: RequestQueue): string {
    return JSON.stringify({
      type: stringifyRequestType(q.type),
      api: q.api,
      payload: q.payload,
      uuid: q.uuid,
      timestamp: q.timestamp,
    });
  }
  static parse(s: string): RequestQueue {
    const o = JSON.parse(s);
    const type = parseRequestType(o.type);
    const timestamp = new Date(o.timestamp);
    const q = new RequestQueue(type, o.api, o.payload, timestamp);
    q.uuid = o.uuid;
    return q;
  }
}
