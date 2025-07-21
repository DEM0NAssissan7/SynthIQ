import Session from "../../models/session";
import { backendStore } from "../../storage/backendStore";
import Backend, { selfID } from "./backend";

const metaSessionStoreEventType = "Meta Event Storage";

class RemoteSessions {
  static storeSession(session: Session) {
    Backend.post(
      "treatments",
      {
        uuid: session.uuid,
        eventType: metaSessionStoreEventType,
        sessionString: Session.stringify(session),
      },
      session.timestamp
    );
    /* We don't need to give this a timestamp as it's
     * already stored in the meal object
     */
  }
  static ignoreUUID(uuid: number) {
    let ignored = backendStore.get("ignoredUUIDs");
    ignored.push(uuid);
    // console.log(ignored);
    backendStore.set("ignoredUUIDs", ignored);
  }
  static clearIgnoredUUIDs() {
    backendStore.set("ignoredUUIDs", []);
  }
  static uuidIsIgnored(uuid: number) {
    let ignored = backendStore.get("ignoredUUIDs");
    for (let u of ignored) if (uuid === u) return true;
    return false;
  }
  static async getAllSessions(allowIgnored: boolean = false) {
    /** We pull meals from nightscout that have been previously saved
     * This is crucial to do analysis.
     */
    let sessions: Session[] = [];
    let treatments = await Backend.get(
      `treatments.json?count=10000&find[eventType]=${metaSessionStoreEventType}&find[created_at][$gte]=2024-01-01T00:00:00Z`
    );
    // console.log(treatments);
    // console.log(treatments);
    treatments.forEach((t: any) => {
      if (
        t.eventType === metaSessionStoreEventType &&
        t.enteredBy === selfID &&
        t.uuid &&
        t.sessionString
      ) {
        if (this.uuidIsIgnored(t.uuid) && !allowIgnored) return;
        try {
          sessions.push(Session.parse(t.sessionString));
        } catch (e) {
          console.error(e);
        }
      }
    });
    return sessions;
  }
}

export default RemoteSessions;
