import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTO_ATTEMPT_KEY, AWAY_MS, UPDATE_TIMEOUT_MS, watchAppUpdates } from "./appUpdate";

type Listener = (...args: unknown[]) => void;

function fakeWorker(state = "installed") {
  const listeners: Listener[] = [];
  return {
    state,
    postMessage: vi.fn(),
    addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
    finishInstall() {
      this.state = "installed";
      for (const listener of listeners) listener();
    },
  };
}

function start({
  waiting = fakeWorker() as ReturnType<typeof fakeWorker> | null,
  controller = true,
  editing = false,
  localVersion = "",
  remoteVersion = "",
  priorAttempt = null as { target: string; at: number } | null,
} = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 6, 12));
  const pageListeners: Record<string, Listener[]> = {};
  const windowListeners: Record<string, Listener[]> = {};
  const registrationListeners: Record<string, Listener[]> = {};
  const swListeners: Record<string, Listener[]> = {};
  const storage = new Map<string, string>();
  if (priorAttempt) storage.set(AUTO_ATTEMPT_KEY, JSON.stringify(priorAttempt));

  const state = { editing };
  const page = {
    hidden: false,
    get activeElement() {
      return state.editing ? { tagName: "INPUT" } : { tagName: "BODY" };
    },
    querySelector: (selector: string) => {
      if (selector === 'meta[name="app-version"]') {
        return localVersion ? { getAttribute: () => localVersion } : null;
      }
      return null;
    },
    addEventListener: (type: string, listener: Listener) => {
      (pageListeners[type] ||= []).push(listener);
    },
  };
  const announced = vi.fn();
  const reload = vi.fn();
  const sw = {
    controller: controller ? {} : null,
    addEventListener: (type: string, listener: Listener) => {
      (swListeners[type] ||= []).push(listener);
    },
    removeEventListener: (type: string, listener: Listener) => {
      swListeners[type] = (swListeners[type] || []).filter((fn) => fn !== listener);
    },
  };
  vi.stubGlobal("document", page);
  vi.stubGlobal("navigator", { serviceWorker: sw });
  vi.stubGlobal("location", { reload });
  vi.stubGlobal("history", { state: {} });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("addEventListener", (type: string, listener: Listener) => {
    (windowListeners[type] ||= []).push(listener);
  });
  vi.stubGlobal("dispatchEvent", announced);
  if (remoteVersion) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: remoteVersion }),
    }));
  } else {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  }
  const registration = {
    waiting,
    installing: null as ReturnType<typeof fakeWorker> | null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: (type: string, listener: Listener) => {
      (registrationListeners[type] ||= []).push(listener);
    },
  };
  watchAppUpdates(registration as unknown as ServiceWorkerRegistration);
  const fire = (map: Record<string, Listener[]>, type: string, ...args: unknown[]) => {
    for (const listener of [...(map[type] || [])]) listener(...args);
  };
  const leave = () => {
    page.hidden = true;
    fire(pageListeners, "visibilitychange");
  };
  const back = () => {
    page.hidden = false;
    fire(pageListeners, "visibilitychange");
  };
  const takeControl = () => fire(swListeners, "controllerchange");
  return { registration, announced, reload, storage, state, leave, back, takeControl, fire, windowListeners, registrationListeners, pageListeners };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("mise à jour automatique de l'application installée", () => {
  it("active et recharge automatiquement dès qu'une version attend sans saisie en cours", () => {
    const { registration, announced, reload, takeControl } = start();
    expect(registration.waiting?.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(announced).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    takeControl();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(announced).not.toHaveBeenCalled();
  });

  it("ne recharge rien sans version qui attend, ni à la toute première installation", () => {
    const idle = start({ waiting: null });
    expect(idle.reload).not.toHaveBeenCalled();
    expect(idle.announced).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    const first = start({ controller: false });
    expect(first.registration.waiting?.postMessage).not.toHaveBeenCalled();
    expect(first.announced).not.toHaveBeenCalled();
  });

  it("patiente pendant une saisie et se lance automatiquement dès qu'elle se termine", () => {
    const { registration, reload, state, takeControl, fire, pageListeners } = start({ editing: true });
    expect(registration.waiting?.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    state.editing = false;
    fire(pageListeners, "focusout");
    vi.advanceTimersByTime(60);
    expect(registration.waiting?.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    takeControl();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("affiche le message manuel seulement si l'activation échoue (timeout)", () => {
    const { announced, reload, leave, back } = start();
    expect(announced).not.toHaveBeenCalled();
    vi.advanceTimersByTime(UPDATE_TIMEOUT_MS);
    expect(reload).not.toHaveBeenCalled();
    expect(announced).toHaveBeenCalledTimes(1);
    expect((announced.mock.calls[0][0] as Event).type).toBe("planning-app-update-available");
    // Après « Plus tard », le rappel d'échec revient à la réouverture, pas après une courte absence.
    leave();
    vi.advanceTimersByTime(AWAY_MS - 1);
    back();
    expect(announced).toHaveBeenCalledTimes(1);
    leave();
    vi.advanceTimersByTime(AWAY_MS);
    back();
    expect(announced).toHaveBeenCalledTimes(2);
  });

  it("détecte un échec via version.json après une tentative auto sans boucler", async () => {
    const { announced, reload } = start({
      waiting: null,
      localVersion: "ancien111111",
      remoteVersion: "nouveau22222",
      priorAttempt: { target: "nouveau22222", at: new Date(2026, 10, 6, 12).getTime() - 10_000 },
    });
    await vi.runOnlyPendingTimersAsync();
    expect(reload).not.toHaveBeenCalled();
    expect(announced).toHaveBeenCalledTimes(1);
    expect((announced.mock.calls[0][0] as Event).type).toBe("planning-app-update-available");
  });

  it("s'applique quand une nouvelle version finit de s'installer pendant l'usage", () => {
    const { registration, registrationListeners, reload, takeControl, fire } = start({ waiting: null });
    const worker = fakeWorker("installing");
    registration.installing = worker;
    fire(registrationListeners, "updatefound");
    expect(worker.postMessage).not.toHaveBeenCalled();
    registration.waiting = worker;
    worker.finishInstall();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    takeControl();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("cherche une version au lancement, au retour, au retour du réseau et chaque minute", () => {
    const { registration, windowListeners, leave, back, fire } = start({ waiting: null });
    expect(registration.update).toHaveBeenCalledTimes(1);
    leave();
    back();
    expect(registration.update).toHaveBeenCalledTimes(2);
    fire(windowListeners, "focus");
    fire(windowListeners, "online");
    expect(registration.update).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(60_000);
    expect(registration.update).toHaveBeenCalledTimes(5);
  });
});
