import { useEffect, useState } from "react";
import type StorageNode from "../lib/storageNode";

export default function useStorageNode(node: StorageNode) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const rerender = () => setVersion((v) => v + 1);
    node.subscribe(rerender);
    return () => {
      node.unsubscribe(rerender);
    };
  }, [node]);

  return node;
}
