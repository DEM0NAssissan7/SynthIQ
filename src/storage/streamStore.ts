import { Stream } from "../models/stream";
import StorageNode from "./storageNode";

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
  {
    const callback = () => {
      streamDelta.write();
    };
    streamDelta.subscribe((value: Stream) => {
      value.unsubscribe(callback);
      value.subscribe(callback);
    });
    streamDelta.notify();
  }
}
