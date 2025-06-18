import { useState, useEffect } from "react";
import NightscoutManager from "../lib/nightscoutManager";
import type Session from "../models/session";

export default function useImportedSessionsState() {
  const [importedSessions, setImportedSessions] = useState<Session[]>([]);

  const [version, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1); // force re-render

  useEffect(() => {
    NightscoutManager.getAllSessions().then((s) => {
      //   console.log(m);
      setImportedSessions(s);
    });
  }, [version]);

  const ignoreSession = (session: Session) => {
    NightscoutManager.ignoreUUID(session.uuid);
    rerender(); // Trigger a re-render to pull new data from nightscout. This is also some kind of dogfooding.
  };
  function clearIgnoredSessions() {
    NightscoutManager.clearIgnoredUUIDs();
    rerender(); // Trigger a re-render to pull new data from nightscout. This is also some kind of dogfooding.
  }

  return {
    ignoreSession,
    importedSessions,
    clearIgnoredSessions,
  };
}
