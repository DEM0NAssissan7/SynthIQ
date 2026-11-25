import Snapshot from "../models/snapshot";
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
  export const stream = node.add(
    "stream",
    new Stream(new Snapshot(), []),
    Stream.serialize,
    Stream.deserialize,
  );
  {
    const callback = () => {
      stream.write();
    };
    stream.subscribe((value: Stream) => {
      value.unsubscribe(callback);
      value.subscribe(callback);
    });
    stream.notify();
  }
}
