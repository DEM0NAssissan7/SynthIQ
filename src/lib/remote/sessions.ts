import Session from "../../models/session";
import { BackendStore } from "../../storage/backendStore";
import Backend, { selfID } from "./backend";

const metaSessionStoreEventType = "Meta Event Storage";

class RemoteSessions {
  static storeSession(session: Session) {
    Backend.post(
      "treatments",
      {
        uuid: session.uuid,
        eventType: metaSessionStoreEventType,
        sessionString: Session.serialize(session),
      },
      session.timestamp
    );
    /* We don't need to give this a timestamp as it's
     * already stored in the meal object
     */
  }
  static ignoreUUID(uuid: number) {
    BackendStore.ignoredUUIDs.value = [
      ...BackendStore.ignoredUUIDs.value,
      uuid,
    ];
  }
  static clearIgnoredUUIDs() {
    BackendStore.ignoredUUIDs.value = [];
  }
  static uuidIsIgnored(uuid: number) {
    for (let u of BackendStore.ignoredUUIDs.value) if (uuid === u) return true;
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
    treatments.forEach((t: any) => {
      if (
        t.eventType === metaSessionStoreEventType &&
        t.enteredBy === selfID &&
        t.uuid &&
        t.sessionString
      ) {
        if (this.uuidIsIgnored(t.uuid) && !allowIgnored) return;
        try {
          sessions.push(Session.deserialize(t.sessionString));
        } catch (e) {
          console.error(e);
        }
      }
    });
    return sessions;
  }
}

export default RemoteSessions;
