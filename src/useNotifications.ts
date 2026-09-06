import { useEffect, useEffectEvent, useState } from "react";
import type { AuthStatus } from "./appModel";

export type NotificationState =
  | "checking"
  | "unsupported"
  | "off"
  | "on"
  | "blocked";

function urlBase64ToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function sameApplicationServerKey(
  current: ArrayBuffer | null,
  expected: Uint8Array,
) {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((byte, index) => byte === expected[index]);
}

async function subscriptionForKey(
  registration: ServiceWorkerRegistration,
  publicKey: string,
) {
  const expectedKey = urlBase64ToBytes(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameApplicationServerKey(subscription.options.applicationServerKey, expectedKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  return subscription || registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: expectedKey,
  });
}

/** Abonne uniquement le compte relié au planning d’Agnès. Les autres comptes
 * Planning Solo ne voient jamais le bouton et ne peuvent pas s’inscrire. */
export function useNotifications(
  authStatus: AuthStatus,
  demoMode: boolean,
  notify: (text: string) => void,
) {
  const [notificationState, setNotificationState] =
    useState<NotificationState>("unsupported");
  const [notificationBusy, setNotificationBusy] = useState(false);

  async function notificationConfig() {
    const response = await fetch("/api/notifications", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 403) {
      setNotificationState("unsupported");
      return null;
    }
    if (!response.ok) throw new Error("Notifications indisponibles");
    return (await response.json()) as { publicKey: string };
  }

  async function refreshNotificationState() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setNotificationState("unsupported");
      return;
    }
    try {
      const config = await notificationConfig();
      if (!config) return;
      if (Notification.permission === "denied") {
        setNotificationState("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setNotificationState("off");
        return;
      }
      const expectedKey = urlBase64ToBytes(config.publicKey);
      if (!sameApplicationServerKey(subscription.options.applicationServerKey, expectedKey)) {
        subscription = await subscriptionForKey(registration, config.publicKey);
      }
      const response = await fetch("/api/notifications", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          subscription: subscription.toJSON(),
        }),
      });
      if (!response.ok) throw new Error("Abonnement indisponible");
      setNotificationState("on");
    } catch {
      setNotificationState("off");
    }
  }
  const refreshNotificationStateEvent = useEffectEvent(refreshNotificationState);

  useEffect(() => {
    if (authStatus !== "ready") {
      setNotificationState("unsupported");
      return;
    }
    if (demoMode) {
      setNotificationState("unsupported");
      return;
    }
    void refreshNotificationStateEvent();
  }, [authStatus, demoMode]);

  async function enableNotifications(options: { silent?: boolean } = {}) {
    const silent = options.silent === true;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setNotificationState("unsupported");
      if (!silent) notify("Ce navigateur ne prend pas en charge les notifications.");
      return;
    }
    setNotificationBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationState(permission === "denied" ? "blocked" : "off");
        if (permission === "denied" && !silent)
          notify("Les notifications sont bloquées dans les réglages du navigateur.");
        return;
      }
      const config = await notificationConfig();
      if (!config) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await subscriptionForKey(registration, config.publicKey);
      const saved = await fetch("/api/notifications", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          subscription: subscription.toJSON(),
        }),
      });
      if (!saved.ok) throw new Error("Abonnement non enregistré");
      setNotificationState("on");
      if (!silent) notify("Rappels activés : vous serez prévenu la veille des notes à 20 h.");
    } catch {
      setNotificationState("off");
      if (!silent) notify("Les notifications n’ont pas pu être activées. Réessayez.");
    } finally {
      setNotificationBusy(false);
    }
  }

  async function disableNotifications() {
    setNotificationBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/notifications", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "unsubscribe",
            endpoint: subscription.endpoint,
          }),
        });
        await subscription.unsubscribe();
      }
      setNotificationState("off");
      notify("Les rappels de notes sont désactivés sur cet appareil.");
    } catch {
      notify("Les notifications n’ont pas pu être désactivées.");
    } finally {
      setNotificationBusy(false);
    }
  }

  return {
    notificationState,
    notificationBusy,
    enableNotifications,
    disableNotifications,
  };
}
