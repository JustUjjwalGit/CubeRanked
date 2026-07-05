import { useEffect, useState } from "react";
import { socketManager } from "../network/socketManager";
import type { SocketDebugSnapshot } from "../network/socketTypes";

export function useSocketConnection(): SocketDebugSnapshot {
  const [snapshot, setSnapshot] = useState<SocketDebugSnapshot>(() => socketManager.getSnapshot());

  useEffect(() => {
    const unsubscribe = socketManager.subscribe(setSnapshot);
    socketManager.connect();

    return unsubscribe;
  }, []);

  return snapshot;
}
