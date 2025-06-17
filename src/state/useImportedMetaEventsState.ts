import { useState, useEffect } from "react";
import NightscoutManager from "../lib/nightscoutManager";
import type MetaEvent from "../models/event";

export default function useImportedMetaEventsState() {
  const [importedEvents, setImportedEvents] = useState<MetaEvent[]>([]);

  const [version, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1); // force re-render

  useEffect(() => {
    NightscoutManager.getAllMetaEvents().then((m) => {
      //   console.log(m);
      setImportedEvents(m);
    });
  }, [version]);

  const ignoreEvent = (event: MetaEvent) => {
    NightscoutManager.ignoreUUID(event.uuid);
    rerender(); // Trigger a re-render to pull new data from nightscout. This is also some kind of dogfooding.
  };
  function clearIgnoredEvents() {
    NightscoutManager.clearIgnoredUUIDs();
    rerender(); // Trigger a re-render to pull new data from nightscout. This is also some kind of dogfooding.
  }

  return {
    ignoreEvent,
    importedEvents,
    clearIgnoredEvents,
  };
}
