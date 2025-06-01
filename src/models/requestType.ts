export enum RequestType {
    GET,
    POST,
    PUT
}

type requestTypeMapKey = [RequestType, string];
const requestTypeMap: requestTypeMapKey[] = [
    [RequestType.GET, "GET"],
    [RequestType.POST, "POST"],
    [RequestType.PUT, "PUT"],
]
export function stringifyRequestType(t: RequestType): string {
    for(let m of requestTypeMap) {
        if(m[0] === t) return m[1];
    }
    throw new Error(`Cannot find a string that matches ${t}`);
}
export function parseRequestType(s: string): RequestType {
    for(let m of requestTypeMap) {
        if(m[1] === s) return m[0];
    }
    throw new Error(`Cannot find type that matches string '${s}'`);
}