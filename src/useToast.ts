import { useEffect, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function notify(text: string) {
    setMessage(text);
  }

  function dismiss() {
    setMessage(null);
  }

  function confirm(text: string) {
    setSuccessMessage(text);
  }

  function dismissSuccess() {
    setSuccessMessage(null);
  }

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  return {
    message,
    notify,
    dismiss,
    successMessage,
    confirm,
    dismissSuccess,
  };
}
