import { useMemo, useRef } from "react";
import { getFormattedTime, getMinuteDiff, getPrettyTime } from "../lib/timing";
import type Insulin from "../models/events/insulin";
import { round } from "../lib/util";
import { useNow } from "../state/useNow";
import { useStream } from "../state/useStream";
import { StreamManager } from "../managers/streamManager";
import { getRecentBoluses } from "../lib/healthMonitor";
import MdIcon from "./md3/MdIcon";
import { totalActivity, totalIOB } from "./hub/hubEvents";
function formatDose(value: number) {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

const HOLD_MS = 500;
const HOLD_SLOP_PX = 10;

/**
 * Remove a dose from the stream, and with it from IOB, the forecast and its
 * session. The treatment already uploaded to Nightscout is not touched.
 */
function deleteDose(insulin: Insulin) {
  const label = `${formatDose(insulin.value)}u ${insulin.variant.name} at ${getPrettyTime(insulin.timestamp)}`;
  if (
    !confirm(
      `Delete ${label}?\n\nIt will no longer count toward insulin on board or the forecast. The copy uploaded to Nightscout is not removed.`,
    )
  )
    return;
  StreamManager.remove(insulin);
}

/** Press-and-hold on a dose row to delete it. */
function useHoldToDelete() {
  const hold = useRef<{
    timer: number;
    x: number;
    y: number;
  } | null>(null);
  const cancel = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };
  return (insulin: Insulin) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancel();
      hold.current = {
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          hold.current = null;
          navigator.vibrate?.(10);
          deleteDose(insulin);
        }, HOLD_MS),
      };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const h = hold.current;
      if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP_PX)
        cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // Stop iOS/Android from opening a text callout or context menu on hold.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
}

/**
 * Insulin on board and its breakdown. Totals use the same functions as the
 * hub's IOB chip and strip (boluses given before `nowMs` and still within
 * their duration), so the numbers always match.
 */
export default function LastBolusMessage({ nowMs }: { nowMs?: number }) {
  const [stream, streamVersion] = useStream();
  const boluses = useMemo(() => getRecentBoluses(stream), [streamVersion]);
  const fallbackNow = useNow(5);
  const holdToDelete = useHoldToDelete();
  const now = new Date(nowMs ?? fallbackNow.getTime());
  const t = now.getTime();

  const given = boluses.filter((b) => b.timestamp.getTime() <= t);
  const totalIOBNow = totalIOB(boluses, t);
  const totalAbsorptionRate = totalActivity(boluses, t);
  const activeBoluses = given
    .filter((insulin) => insulin.getActivityStatus(now))
    .sort((a, b) => b.iob(now) - a.iob(now));

  if (activeBoluses.length === 0) {
    return (
      <div className="text-muted small py-1">
        No active insulin currently on board.
      </div>
    );
  }

  const latestBolus = [...given].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  )[0];

  return (
    <div className="d-flex flex-column gap-2.5">
      <div className="d-flex align-items-baseline justify-content-between px-1">
        <div>
          <div
            className="text-uppercase fw-bold text-muted"
            style={{ fontSize: "0.74rem", letterSpacing: "0.06em" }}
          >
            On Board (IOB)
          </div>
          <div className="d-flex align-items-baseline gap-1 mt-0.5">
            <span
              className="fw-bold text-body"
              style={{
                fontSize: "2.1rem",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {formatDose(totalIOBNow)}
            </span>
            <span
              className="text-body-secondary fw-semibold"
              style={{ fontSize: "1.15rem" }}
            >
              u
            </span>
          </div>
        </div>
        <div className="text-end">
          <div
            className="text-uppercase fw-bold text-muted"
            style={{ fontSize: "0.74rem", letterSpacing: "0.06em" }}
          >
            Activity Rate
          </div>
          <div
            className="fw-bold text-body mt-0.5"
            style={{ fontSize: "1.2rem", lineHeight: 1.2 }}
          >
            {formatDose(totalAbsorptionRate)}{" "}
            <span
              className="text-muted fw-normal"
              style={{ fontSize: "0.88rem" }}
            >
              u/hr
            </span>
          </div>
          {latestBolus && (
            <div
              className="text-muted small mt-1"
              style={{ fontSize: "0.82rem" }}
            >
              Last: {formatDose(latestBolus.value)}u ·{" "}
              {getFormattedTime(getMinuteDiff(now, latestBolus.timestamp))} ago
            </div>
          )}
        </div>
      </div>

      <div className="d-flex flex-column gap-1">
        {activeBoluses.map((insulin, index) => {
          const iob = insulin.iob(now);
          return (
            <div
              key={`${insulin.timestamp.getTime()}-${insulin.variant.name}-${index}`}
              className="app-dose-item app-dose-item-holdable"
              title="Press and hold to delete"
              {...holdToDelete(insulin)}
            >
              <span className="dose-name">
                <MdIcon name="syringe" className="text-primary" size={18} />
                <span>
                  {formatDose(insulin.value)}u {insulin.variant.name}
                  <span className="dose-sub ms-1">
                    · {getFormattedTime(getMinuteDiff(now, insulin.timestamp))}{" "}
                    ago
                  </span>
                </span>
              </span>
              <span className="dose-value">
                {formatDose(iob)}u{" "}
                <span
                  className="text-muted fw-normal"
                  style={{ fontSize: "0.82rem" }}
                >
                  IOB
                </span>
              </span>
            </div>
          );
        })}
        <div className="text-muted small px-1 mt-1">
          Press and hold a dose to delete it.
        </div>
      </div>
    </div>
  );
}
