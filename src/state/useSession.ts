import { useState, useEffect } from "react";
import type Session from "../models/session";
import { wizardStorage } from "../storage/wizardStore";

export default function useSession(session: Session) {
  const [, setVersion] = useState(0);

  const rerender = () => setVersion((v) => v + 1); // force re-render
  useEffect(() => {
    session.subscribe(rerender);
    return () => session.unsubscribe(rerender);
  }, []);

  return session;
}

export function useWizardSession() {
  return useSession(wizardStorage.get("session"));
}
