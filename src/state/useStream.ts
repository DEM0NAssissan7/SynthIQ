import { useEffect, useReducer } from "react";
import type { Stream } from "../models/stream";
import { StreamManager } from "../managers/streamManager";

/**
 * The stream, and a version that changes whenever the stream does. The stream
 * is modified in place, so it cannot be a memo dependency itself: depend on
 * the version instead.
 */
export function useStream(): [Stream, number] {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    StreamManager.stream.subscribe(bump);
    return () => StreamManager.stream.unsubscribe(bump);
  }, []);
  return [StreamManager.stream, version];
}
