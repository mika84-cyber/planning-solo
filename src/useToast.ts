import { useEffect, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [undoOffer, setUndoOffer] = useState<{
    message: string;
    action: () => void | Promise<void>;
  } | null>(null);

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

  function offerUndo(message: string, action: () => void | Promise<void>) {
    setSuccessMessage(null);
    setUndoOffer({ message, action });
  }

  function dismissUndo() {
    setUndoOffer(null);
  }

  function runUndo() {
    const action = undoOffer?.action;
    setUndoOffer(null);
    if (action) void action();
  }

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (!undoOffer) return;
    const timeout = window.setTimeout(() => setUndoOffer(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [undoOffer]);

  return {
    message,
    notify,
    dismiss,
    successMessage,
    confirm,
    dismissSuccess,
    undoOffer,
    offerUndo,
    dismissUndo,
    runUndo,
  };
}
