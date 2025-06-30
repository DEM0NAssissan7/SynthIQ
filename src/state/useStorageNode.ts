import { useEffect, useState } from "react";
import type StorageNode from "../lib/storageNode";

export default function useStorageNode(node: StorageNode) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const rerender = () => setVersion((v) => v + 1);
    node.subscribeGeneral(rerender);
    return () => {
      node.unsubscribeGeneral(rerender);
    };
  }, [node]);

  return node;
}
