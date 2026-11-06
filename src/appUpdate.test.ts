import { afterEach, describe, expect, it, vi } from "vitest";
import { AWAY_MS, watchAppUpdates } from "./appUpdate";

type Listener = () => void;

/** Un service worker réduit à ce que le suivi regarde : son état, et ses écouteurs. */
function fakeWorker(state = "installed") {
  const listeners: Listener[] = [];
  return {
    state,
    addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
    finishInstall() {
      this.state = "installed";
      for (const listener of listeners) listener();
    },
  };
}

/** Une page et son enregistrement : combien de fois la fenêtre est demandée,
 *  et les gestes de passage en arrière-plan et de retour. */
function start({ waiting = fakeWorker() as ReturnType<typeof fakeWorker> | null, controller = true } = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 6, 12));
  const pageListeners: Record<string, Listener> = {};
  const windowListeners: Record<string, Listener> = {};
  const registrationListeners: Record<string, Listener> = {};
  const page = { hidden: false, addEventListener: (type: string, listener: Listener) => { pageListeners[type] = listener; } };
  const announced = vi.fn();
  vi.stubGlobal("document", page);
  vi.stubGlobal("navigator", { serviceWorker: { controller: controller ? {} : null } });
  vi.stubGlobal("addEventListener", (type: string, listener: Listener) => { windowListeners[type] = listener; });
  vi.stubGlobal("dispatchEvent", announced);
  const registration = {
    waiting,
    installing: null as ReturnType<typeof fakeWorker> | null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: (type: string, listener: Listener) => { registrationListeners[type] = listener; },
  };
  watchAppUpdates(registration as unknown as ServiceWorkerRegistration);
  const leave = () => {
    page.hidden = true;
    pageListeners.visibilitychange();
  };
  const back = () => {
    page.hidden = false;
    pageListeners.visibilitychange();
  };
  return { registration, announced, leave, back, windowListeners, registrationListeners };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("mise à jour de l'application installée", () => {
  it("demande dès qu'une version attend, même si la page vient d'être lancée", () => {
    const { announced } = start();
    expect(announced).toHaveBeenCalledTimes(1);
    expect(announced.mock.calls[0][0].type).toBe("planning-app-update-available");
  });

  it("ne demande rien sans version qui attend, ni à la toute première installation", () => {
    expect(start({ waiting: null }).announced).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    expect(start({ controller: false }).announced).not.toHaveBeenCalled();
  });

  it("demande quand une nouvelle version finit de s'installer pendant l'usage", () => {
    const { registration, registrationListeners, announced } = start({ waiting: null });
    const worker = fakeWorker("installing");
    registration.installing = worker;
    registrationListeners.updatefound();
    expect(announced).not.toHaveBeenCalled();
    registration.waiting = worker;
    worker.finishInstall();
    expect(announced).toHaveBeenCalledTimes(1);
  });

  it("après « Plus tard », redemande à la réouverture, pas après une courte absence", () => {
    const { announced, leave, back } = start();
    expect(announced).toHaveBeenCalledTimes(1);
    // Le temps de lire un message : on ne redemande pas.
    leave();
    vi.advanceTimersByTime(AWAY_MS - 1);
    back();
    expect(announced).toHaveBeenCalledTimes(1);
    // Une minute d'absence : c'est une réouverture.
    leave();
    vi.advanceTimersByTime(AWAY_MS);
    back();
    expect(announced).toHaveBeenCalledTimes(2);
  });

  it("cherche une version au lancement, au retour, au retour du réseau et chaque minute", () => {
    const { registration, windowListeners, leave, back } = start();
    expect(registration.update).toHaveBeenCalledTimes(1);
    leave();
    back();
    expect(registration.update).toHaveBeenCalledTimes(2);
    windowListeners.focus();
    windowListeners.online();
    expect(registration.update).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(60_000);
    expect(registration.update).toHaveBeenCalledTimes(5);
  });
});
