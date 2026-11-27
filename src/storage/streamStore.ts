import { Stream } from "../models/stream";
import StorageNode from "./storageNode";
import type { UUID } from "../models/types/types";

export namespace StreamStore {
  const node = new StorageNode("stream");

  export const lastRemoteSyncTime = node.add(
    "lastRemoteSyncTime",
    new Date(0),
    (a) => a.getTime(),
    (o) => new Date(o),
  );
  export const lastDeltaSyncTimestamp = node.add(
    "lastDeltaSyncTimestamp",
    new Date(),
    (a) => a.getTime(),
    (o) => new Date(o),
  );
  export const syncHoursSchedule = node.add("syncHoursSchedule", 36);
  export const streamMain = node.add(
    "stream",
    new Stream(),
    Stream.serialize,
    Stream.deserialize,
  );
  export const streamDelta = node.add(
    "streamDelta",
    new Stream(),
    Stream.serialize,
    Stream.deserialize,
  );
  /** Uuids of the main stream's events removed since the last compaction */
  export const streamDeltaRemoved = node.add<UUID[]>("streamDeltaRemoved", []);
}
