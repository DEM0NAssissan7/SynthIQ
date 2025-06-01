import { parseRequestType, stringifyRequestType, type RequestType } from "./requestType";

export default class RequestQueue {
    type: RequestType;
    api: string; // URL stub
    payload: any = {};
    timestamp: Date;
    constructor(type: RequestType, api: string, timestamp: Date, payload?: any) {
        this.type = type;
        this.api = api;
        this.timestamp = timestamp;
        this.payload = payload || {};
    }
    static stringify(q: RequestQueue): string {
        return JSON.stringify({
            type: stringifyRequestType(q.type),
            api: q.api,
            payload: q.payload,
            timestamp: q.timestamp
        })
    }
    static parse(s: string): RequestQueue {
        const o = JSON.parse(s);
        const type = parseRequestType(o.type);
        const timestamp = new Date(o.timestamp);
        const q = new RequestQueue(type, o.api, timestamp, o.payload);
        return q;
    }
}