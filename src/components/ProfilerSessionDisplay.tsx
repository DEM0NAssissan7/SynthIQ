import { Button } from "react-bootstrap";
import { getFullPrettyDate } from "../lib/timing";
import { round } from "../lib/util";
import type Session from "../models/session";
import SessionGraph from "./SessionGraph";

interface ProfilerSessionDisplayProps {
  session: Session;
  ignoreSession: (a: Session) => void;
  from: number;
  until?: number;
  width?: string | number;
  height?: string | number;
  ymin?: string | number;
}

export default function ProfilerSessionDisplay({
  session: session,
  ignoreSession,
  from,
  until,
  width,
  height,
  ymin,
}: ProfilerSessionDisplayProps) {
  // Ignore Meal
  function onIgnoreClick() {
    if (
      confirm(
        `Are you sure you want to ignore this session? UUID: ${session.uuid}`
      )
    ) {
      ignoreSession(session);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <SessionGraph
        session={session}
        from={from}
        until={until}
        width={width}
        height={height}
        ymin={ymin}
      />
      {getFullPrettyDate(session.timestamp)}
      <br />
      {round(session.carbs, 2)}g carbs
      <br />
      {round(session.protein, 2)}g protein
      <br />
      {round(session.fat, 2)}g fat
      <br />
      {session.insulin}u insulin
      {session.glucose > 0 && (
        <>
          <br />
          {session.glucose} caps of glucose
        </>
      )}
      <Button variant="danger" onClick={onIgnoreClick}>
        Ignore
      </Button>
    </div>
  );
}
