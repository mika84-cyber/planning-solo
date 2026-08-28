import type { Dispatch, FormEvent, SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AuthStatus } from "./appModel";
import {
  normalizedAccountEmail,
  passwordValidationError,
  useAuthenticationActions,
  validAccountEmail,
  type AuthenticationServices,
} from "./useAuthenticationActions";

function setter<T>() {
  return vi.fn<(value: SetStateAction<T>) => void>() as Dispatch<
    SetStateAction<T>
  >;
}

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as FormEvent;
}

function actionFixture(overrides: Partial<AuthenticationServices> = {}) {
  const services: AuthenticationServices = {
    login: vi.fn().mockResolvedValue(undefined),
    requestPasswordRecovery: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    acceptInvite: vi.fn().mockResolvedValue({ email: "invite@example.test" }),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const setAuthError = setter<string>();
  const loadCalendar = vi.fn().mockResolvedValue(undefined);
  const actions = useAuthenticationActions({
    demoMode: false,
    loginEmail: "  USER@Example.TEST ",
    loginPassword: "motdepasse",
    passwordConfirmation: "motdepasse",
    inviteToken: "invite-token",
    setLoginPassword: setter<string>(),
    setPasswordConfirmation: setter<string>(),
    setAuthBusy: setter<boolean>(),
    setAuthError,
    setAuthNotice: setter<string>(),
    setUserEmail: setter<string>(),
    setIsProgramAdmin: setter<boolean>(),
    setAuthStatus: setter<AuthStatus>(),
    guidePromptCheckedRef: { current: false },
    handoffKey: "planning:test-handoff",
    loadCalendar,
    clearCalendarData: vi.fn(),
    confirmMessage: vi.fn(),
    services,
  });
  return { actions, services, setAuthError, loadCalendar };
}

describe("useAuthenticationActions", () => {
  it("normalise les adresses et valide les mots de passe avant l’API", () => {
    expect(normalizedAccountEmail("  USER@Example.TEST ")).toBe(
      "user@example.test",
    );
    expect(validAccountEmail("user@example.test")).toBe(true);
    expect(validAccountEmail("user@example")).toBe(false);
    expect(passwordValidationError("court")).toContain("8 caractères");
    expect(passwordValidationError("motdepasse", "différent")).toContain(
      "pas identiques",
    );
    expect(passwordValidationError("motdepasse", "motdepasse")).toBe("");
  });

  it("connecte avec l’adresse normalisée puis charge le calendrier", async () => {
    const { actions, services, loadCalendar } = actionFixture();
    await actions.submitLogin(submitEvent());
    expect(services.login).toHaveBeenCalledWith(
      "user@example.test",
      "motdepasse",
    );
    expect(loadCalendar).toHaveBeenCalledOnce();
  });

  it("n’appelle pas la récupération distante lorsque l’adresse est invalide", async () => {
    const services: AuthenticationServices = {
      login: vi.fn().mockResolvedValue(undefined),
      requestPasswordRecovery: vi.fn().mockResolvedValue(undefined),
      updatePassword: vi.fn().mockResolvedValue(undefined),
      acceptInvite: vi.fn().mockResolvedValue({}),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    const setAuthError = setter<string>();
    const actions = useAuthenticationActions({
      demoMode: false,
      loginEmail: "adresse-invalide",
      loginPassword: "motdepasse",
      passwordConfirmation: "motdepasse",
      inviteToken: "",
      setLoginPassword: setter<string>(),
      setPasswordConfirmation: setter<string>(),
      setAuthBusy: setter<boolean>(),
      setAuthError,
      setAuthNotice: setter<string>(),
      setUserEmail: setter<string>(),
      setIsProgramAdmin: setter<boolean>(),
      setAuthStatus: setter<AuthStatus>(),
      guidePromptCheckedRef: { current: false },
      handoffKey: "planning:test-handoff",
      loadCalendar: vi.fn().mockResolvedValue(undefined),
      clearCalendarData: vi.fn(),
      confirmMessage: vi.fn(),
      services,
    });
    await actions.requestPasswordReset();
    expect(services.requestPasswordRecovery).not.toHaveBeenCalled();
    expect(setAuthError).toHaveBeenCalledWith(
      "Indiquez d’abord l’adresse e-mail de votre compte.",
    );
  });
});
