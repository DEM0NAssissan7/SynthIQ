import { useState, useEffect } from "react";
import type Session from "../models/session";
import RemoteSessions from "../lib/remote/sessions";

export default function useImportedSessionsState(
  allowIgnored: boolean = false
) {
  const [importedSessions, setImportedSessions] = useState<Session[]>([]);

  const [version, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1); // force re-render

  useEffect(() => {
    RemoteSessions.getAllSessions(allowIgnored).then((s) => {
      //   console.log(m);
      setImportedSessions(s);
    });
  }, [version]);

  const ignoreSession = (session: Session) => {
    RemoteSessions.ignoreUUID(session.uuid);
    rerender(); // Trigger a re-render to pull new data from nightscout. This is also some kind of dogfooding.
  };
  function clearIgnoredSessions() {
    RemoteSessions.clearIgnoredUUIDs();
    rerender(); // Trigger a re-render to pull new data from nightscout. This is also some kind of dogfooding.
  }

  return {
    ignoreSession,
    importedSessions,
    clearIgnoredSessions,
  };
}
