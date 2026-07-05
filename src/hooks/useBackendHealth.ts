import { useEffect, useState } from "react";
import { fetchHealth, type HealthState } from "../lib/api";

interface BackendHealthInfo {
  state: HealthState;
  version: string | null;
  latencyMs: number | null;
}

export function useBackendHealth(pollIntervalMs = 15_000): BackendHealthInfo {
  const [state, setState] = useState<HealthState>("connecting");
  const [version, setVersion] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let timeout = 0;
    let interval = 0;

    const runCheck = async () => {
      const started = performance.now();

      try {
        const health = await fetchHealth();
        if (!active) return;
        setState(health.server === "ok" ? "connected" : "offline");
        setVersion(health.version);
        setLatencyMs(Math.round(performance.now() - started));
      } catch {
        if (!active) return;
        setState("offline");
        setLatencyMs(null);
      }
    };

    void runCheck();
    interval = window.setInterval(() => void runCheck(), pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pollIntervalMs]);

  return { state, version, latencyMs };
}
