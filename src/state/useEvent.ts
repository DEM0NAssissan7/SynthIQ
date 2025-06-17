import { useState, useEffect } from "react";
import type MetaEvent from "../models/event";
import { wizardStorage } from "../storage/wizardStore";

export default function useEvent(event: MetaEvent) {
  const [, setVersion] = useState(0);

  const rerender = () => setVersion((v) => v + 1); // force re-render
  useEffect(() => {
    event.subscribe(rerender);
    return () => event.unsubscribe(rerender);
  }, []);

  return event;
}

export function useWizardEvent() {
  return useEvent(wizardStorage.get("event"));
}
