import { useCallback, useEffect, useState } from "react";
import {
  dismissFeedbackResolution,
  getFeedbackResolutionNotices,
  getFeedbackSummary,
  type FeedbackResolutionNotice,
} from "./feedbackApi";

export function useFeedbackMessaging(isAdmin: boolean, demoMode: boolean, enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [resolutionNotices, setResolutionNotices] = useState<FeedbackResolutionNotice[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (demoMode) {
      setUnreadCount(isAdmin ? 1 : 0);
      const showDemoResolution = new URLSearchParams(location.search).get("demo-feedback-resolved") === "1";
      const showDemoReply = new URLSearchParams(location.search).get("demo-feedback-reply") === "1";
      setResolutionNotices(showDemoReply
        ? [{ id: "22222222-2222-2222-2222-222222222222", kind: "suggestion", type: "reply", message: "Merci pour votre message. Votre proposition sera ajoutée à la prochaine mise à jour.", createdAt: new Date().toISOString() }]
        : showDemoResolution ? [{ id: "11111111-1111-1111-1111-111111111111", kind: "bug", type: "resolved", resolvedAt: new Date().toISOString() }] : []);
      return;
    }
    const [noticeResult, summaryResult] = await Promise.allSettled([
      getFeedbackResolutionNotices(),
      isAdmin ? getFeedbackSummary() : Promise.resolve({ unreadCount: 0 }),
    ]);
    if (noticeResult.status === "fulfilled") setResolutionNotices(noticeResult.value.notifications);
    if (summaryResult.status === "fulfilled") setUnreadCount(summaryResult.value.unreadCount);
  }, [demoMode, enabled, isAdmin]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const check = async () => {
      if (!active || document.visibilityState !== "visible") return;
      await refresh();
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, refresh]);

  const dismissResolution = useCallback(async (id: string) => {
    setResolutionNotices((current) => current.filter((notice) => notice.id !== id));
    if (!demoMode) {
      try {
        await dismissFeedbackResolution(id);
      } catch {
        void refresh();
      }
    }
  }, [demoMode, refresh]);

  return {
    unreadCount,
    setUnreadCount,
    resolutionNotice: resolutionNotices[0] || null,
    dismissResolution,
    refresh,
  };
}
