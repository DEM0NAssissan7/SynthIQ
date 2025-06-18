import { Button } from "react-bootstrap";
import { getFullPrettyDate } from "../lib/timing";
import { round } from "../lib/util";
import type MetaEvent from "../models/event";
import EventGraph from "./EventGraph";

interface ProfilerEventDisplayProps {
  event: MetaEvent;
  ignoreEvent: (a: MetaEvent) => void;
  from: number;
  until?: number;
  width?: string | number;
  height?: string | number;
  ymin?: string | number;
}

export default function ProfilerEventDisplay({
  event,
  ignoreEvent,
  from,
  until,
  width,
  height,
  ymin,
}: ProfilerEventDisplayProps) {
  // Ignore Meal
  function onIgnoreClick() {
    if (
      confirm(`Are you sure you want to ignore this event? UUID: ${event.uuid}`)
    ) {
      ignoreEvent(event);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <EventGraph
        event={event}
        from={from}
        until={until}
        width={width}
        height={height}
        ymin={ymin}
      />
      {getFullPrettyDate(event.timestamp)}
      <br />
      {round(event.carbs, 2)}g carbs
      <br />
      {round(event.protein, 2)}g protein
      <br />
      {round(event.fat, 2)}g fat
      <br />
      {event.insulin}u insulin
      {event.glucose > 0 && (
        <>
          <br />
          {event.glucose} caps of glucose
        </>
      )}
      <Button variant="danger" onClick={onIgnoreClick}>
        Ignore
      </Button>
    </div>
  );
}
