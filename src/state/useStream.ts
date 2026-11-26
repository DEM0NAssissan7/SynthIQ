import { useEffect, useReducer } from "react";
import type { Stream } from "../models/stream";
import { StreamStore } from "../storage/streamStore";

/**
 * The stream, and a version that changes whenever the stream does. The stream
 * is modified in place, so it cannot be a memo dependency itself: depend on
 * the version instead.
 */
export function useStream(): [Stream, number] {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    StreamStore.stream.subscribe(bump);
    return () => StreamStore.stream.unsubscribe(bump);
  }, []);
  return [StreamStore.stream.value, version];
}
