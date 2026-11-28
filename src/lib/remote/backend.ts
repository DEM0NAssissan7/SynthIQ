import RequestQueue from "../../models/requestQueue";
import RequestType from "../../models/types/requestType";
import { BackendStore } from "../../storage/backendStore";
import { PrivateStore } from "../../storage/privateStore";

// Developer options
const errorLogging = false;
/** Documents per request in getAll: a full page means there may be more */
const pageSize = 1000;

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
  private static async deleteRequest(api: string) {
    return await fetch(this.getApiPath(api), {
      headers: {
        accept: "*/*",
        "api-secret": PrivateStore.apiSecret.value,
        "x-requested-with": "XMLHttpRequest",
      },
      referrerPolicy: "strict-origin-when-cross-origin",
      method: "DELETE",
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
      case RequestType.DELETE:
        a = await this.deleteRequest(api);
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
  /**
   * Every document of `path` whose `field` lies between two times, fetched
   * newest first a page at a time until a page comes back short. Throws if a
   * request fails, so a sync never advances past what it did not receive.
   */
  static async getAll(
    path: string,
    field: "dateString" | "date" | "created_at",
    from: number,
    to: number,
  ): Promise<any[]> {
    const format = (t: number) =>
      field === "date" ? `${t}` : new Date(t).toISOString();
    const timeOf = (d: any) =>
      field === "created_at" ? Date.parse(d.created_at) : Number(d.date);
    const all = new Map<string, any>();
    let until = to;
    while (true) {
      const page = await this.get(
        `${path}?find[${field}][$gte]=${format(from)}&find[${field}][$lte]=${format(until)}&count=${pageSize}`,
      );
      if (!Array.isArray(page))
        throw new Error(`Nightscout: GET ${path} failed`);
      const known = all.size;
      for (const d of page) all.set(d._id, d);
      // A short page is the last; a page with nothing new cannot go further back
      if (page.length < pageSize || all.size === known) break;
      until = page.reduce((t, d) => Math.min(t, timeOf(d)), until);
    }
    return Array.from(all.values());
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
  /** Queued like a post, so a delete made offline is sent once back online (in order) */
  static async delete(api: string) {
    addRequest(RequestType.DELETE, api);
    await this.fulfillRequests();
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
