import { useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  function notify(text: string) {
    setMessage(text);
  }

  function dismiss() {
    setMessage(null);
  }

  return { message, notify, dismiss };
}
