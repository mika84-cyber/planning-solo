import { useCallback, useEffect, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [undoOffer, setUndoOffer] = useState<{
    message: string;
    action: () => void | Promise<void>;
  } | null>(null);

  const notify = useCallback((text: string) => {
    setMessage(text);
  }, []);

  const dismiss = useCallback(() => {
    setMessage(null);
  }, []);

  const confirm = useCallback((text: string) => {
    setSuccessMessage(text);
  }, []);

  const dismissSuccess = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  const offerUndo = useCallback((message: string, action: () => void | Promise<void>) => {
    setSuccessMessage(null);
    setUndoOffer({ message, action });
  }, []);

  const dismissUndo = useCallback(() => {
    setUndoOffer(null);
  }, []);

  const runUndo = useCallback(() => {
    const action = undoOffer?.action;
    setUndoOffer(null);
    if (action) void action();
  }, [undoOffer]);

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
