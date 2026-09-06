import { useEffect, useRef } from "react";
import { useNotifications } from "./useNotifications";

type NoteReminderButtonProps = {
  demoMode: boolean;
  notify: (text: string) => void;
};

export default function NoteReminderButton({
  demoMode,
  notify,
}: NoteReminderButtonProps) {
  const {
    notificationState,
    notificationBusy,
    enableNotifications,
  } = useNotifications("ready", demoMode, notify);
  const activationStarted = useRef(false);

  useEffect(() => {
    if (notificationState !== "off" || notificationBusy || activationStarted.current) return;
    const activate = () => {
      if (activationStarted.current) return;
      activationStarted.current = true;
      void enableNotifications({ silent: true });
    };
    if (Notification.permission === "granted") {
      activate();
      return;
    }
    window.addEventListener("pointerdown", activate, { once: true, capture: true });
    window.addEventListener("keydown", activate, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", activate, { capture: true });
      window.removeEventListener("keydown", activate, { capture: true });
    };
  }, [enableNotifications, notificationBusy, notificationState]);

  return null;
}
