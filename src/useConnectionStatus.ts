import { useEffect, useState } from "react";

type SyncStatus = "idle" | "saving" | "saved" | "error";

export function useConnectionStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ status: SyncStatus; at: string }>)
        .detail;
      setSyncStatus(detail.status);
      if (detail.status === "saved") setLastSavedAt(detail.at);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("calendar-sync", sync);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("calendar-sync", sync);
    };
  }, []);

  useEffect(() => {
    if (syncStatus !== "saved") return;
    const timer = window.setTimeout(() => setSyncStatus("idle"), 3500);
    return () => window.clearTimeout(timer);
  }, [syncStatus]);

  return { online, syncStatus, lastSavedAt };
}
