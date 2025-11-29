import RequestQueue from "../../models/requestQueue";
import RequestType from "../../models/types/requestType";
import { BackendStore } from "../../storage/backendStore";
import { PrivateStore } from "../../storage/privateStore";

// Developer options
const errorLogging = false;

// Request Queue Management
function addRequest(
  type: RequestType,
  api: string,
  payload?: any,
  timestamp?: Date
): void {
  const newQueue = [
    ...BackendStore.queue.value,
    new RequestQueue(type, api, payload, timestamp),
  ];
  BackendStore.queue.value = newQueue;
}
function fullfilRequest(request: RequestQueue): void {
  const queue = BackendStore.queue.value;
  BackendStore.queue.value = queue.filter(
    (a: RequestQueue) => a.uuid !== request.uuid
  );
}

export const selfID = "SynthIQ";
class Backend {
  // Basic request stuff
  private static getApiPath(api: string): string {
    return `${BackendStore.url.value}/api/v1/${api}`;
  }
  private static async postRequest(api: string, payload: any, timestamp: Date) {
    payload.enteredBy = selfID;
    payload.created_at = timestamp;
    payload.eventTime = timestamp;
    return await fetch(this.getApiPath(api), {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "api-secret": PrivateStore.apiSecret.value,
        "content-type": "application/json; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      referrerPolicy: "strict-origin-when-cross-origin",
      body: JSON.stringify(payload),
      method: "POST",
      mode: "cors",
      credentials: "omit",
    });
  }
  private static async putRequest(api: string, payload: any) {
    return await fetch(this.getApiPath(api), {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "api-secret": PrivateStore.apiSecret.value,
        "content-type": "application/json; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      referrerPolicy: "strict-origin-when-cross-origin",
      body: JSON.stringify(payload),
      method: "PUT",
      mode: "cors",
      credentials: "omit",
    });
  }
  static async executeRequest(request: RequestQueue) {
    const api = request.api;
    const payload = request.payload;
    const timestamp = request.timestamp;

    let a: Response;
    switch (request.type) {
      case RequestType.POST:
        a = await this.postRequest(api, payload, timestamp);
        break;
      case RequestType.PUT:
        a = await this.putRequest(api, payload);
        break;
      case RequestType.GET:
        return await this.get(api);
    }
    if (a.ok) return fullfilRequest(request);

    console.error(`Cannot fulfill request. HTTP status code '${a.status}'`);
  }

  // REST Queue
  static async get(api: string, options?: any) {
    let a = await fetch(this.getApiPath(api), {
      method: "GET",
      headers: {
        "api-secret": PrivateStore.apiSecret.value,
      },
      mode: "cors",
      credentials: "omit",
      ...options, // allows override or extension
    });
    try {
      if (a.ok) {
        if (a) return a.json();
        else throw new Error("Nightscout: GET request gave invalid data");
      } else if (errorLogging)
        throw new Error(
          `Nightscout: GET request failed - HTTP status code '${a.status}'`
        );
    } catch (e) {
      if (errorLogging) console.error(e);
    }
  }
  static async post(api: string, payload: any, timestamp: Date) {
    addRequest(RequestType.POST, api, payload, timestamp);
    await this.fulfillRequests();
  }
  static async put(api: string, payload: any, useQueue: boolean) {
    if (useQueue) {
      addRequest(RequestType.PUT, api, payload);
      await this.fulfillRequests();
    } else {
      await this.executeRequest(
        new RequestQueue(RequestType.PUT, api, payload)
      );
    }
  }
  static async fulfillRequests() {
    for (const request of BackendStore.queue.value) {
      await this.executeRequest(request);
    }
  }

  // Auth
  static async verifyAuth() {
    return await this.get("verifyauth");
  }

  // Meta
  static urlIsValid() {
    return BackendStore.url.value !== null;
  }
  static skipSetup() {
    BackendStore.skipSetup.value = true;
  }
}

export default Backend;
