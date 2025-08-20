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
  private static postRequest(api: string, payload: any, timestamp: Date) {
    payload.enteredBy = selfID;
    payload.created_at = timestamp;
    payload.eventTime = timestamp;
    return fetch(this.getApiPath(api), {
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
  private static putRequest(api: string, payload: any) {
    return fetch(this.getApiPath(api), {
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

  // REST Queue
  static async get(api: string, options?: any) {
    return await fetch(this.getApiPath(api), {
      method: "GET",
      headers: {
        "api-secret": PrivateStore.apiSecret.value,
      },
      mode: "cors",
      credentials: "omit",
      ...options, // allows override or extension
    })
      .then((a) => {
        if (a.ok) {
          if (a) return a.json();
          else throw new Error("Nightscout: GET request gave invalid data");
        } else if (errorLogging)
          throw new Error(
            `Nightscout: GET request failed - HTTP status code '${a.status}'`
          );
      })
      .catch((e) => {
        if (errorLogging) console.error(e);
      });
  }
  static post(api: string, payload: any, timestamp: Date): void {
    addRequest(RequestType.POST, api, payload, timestamp);
    this.fulfillRequests();
  }
  static put(api: string, payload: any): void {
    addRequest(RequestType.PUT, api, payload);
    this.fulfillRequests();
  }
  static fulfillRequests(): void {
    for (let request of BackendStore.queue.value) {
      const api = request.api;
      const payload = request.payload;
      const timestamp = request.timestamp;
      const fulfill = (a: Response) => {
        if (a.ok) fullfilRequest(request);
        else
          console.error(
            `Cannot fulfill request. HTTP status code '${a.status}'`
          );
      };
      switch (request.type) {
        case RequestType.POST:
          this.postRequest(api, payload, timestamp).then(fulfill);
          break;
        case RequestType.PUT:
          this.putRequest(api, payload).then(fulfill);
          break;
      }
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
