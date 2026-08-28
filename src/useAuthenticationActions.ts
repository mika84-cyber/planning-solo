import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import {
  acceptInvite,
  login,
  logout,
  requestPasswordRecovery,
  updateUser,
} from "@netlify/identity";
import { calendarErrorMessage } from "./calendarApi";
import type { AuthStatus } from "./appModel";

type SetState<T> = Dispatch<SetStateAction<T>>;

export type AuthenticationServices = {
  login: (email: string, password: string) => Promise<unknown>;
  requestPasswordRecovery: (email: string) => Promise<unknown>;
  updatePassword: (password: string) => Promise<unknown>;
  acceptInvite: (
    token: string,
    password: string,
  ) => Promise<{ email?: string | null }>;
  logout: () => Promise<unknown>;
};

const defaultServices: AuthenticationServices = {
  login,
  requestPasswordRecovery,
  updatePassword: (password) => updateUser({ password }),
  acceptInvite,
  logout,
};

type AuthenticationActionsOptions = {
  demoMode: boolean;
  loginEmail: string;
  loginPassword: string;
  passwordConfirmation: string;
  inviteToken: string;
  setLoginPassword: SetState<string>;
  setPasswordConfirmation: SetState<string>;
  setAuthBusy: SetState<boolean>;
  setAuthError: SetState<string>;
  setAuthNotice: SetState<string>;
  setUserEmail: SetState<string>;
  setIsProgramAdmin: SetState<boolean>;
  setAuthStatus: SetState<AuthStatus>;
  guidePromptCheckedRef: RefObject<boolean>;
  handoffKey: string;
  loadCalendar: () => Promise<void>;
  clearCalendarData: () => void;
  confirmMessage: (message: string) => void;
  services?: AuthenticationServices;
};

export function normalizedAccountEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validAccountEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(normalizedAccountEmail(value));
}

export function passwordValidationError(
  password: string,
  confirmation?: string,
) {
  if (password.length < 8)
    return "Choisissez un mot de passe d’au moins 8 caractères.";
  if (confirmation !== undefined && password !== confirmation)
    return "Les deux mots de passe ne sont pas identiques.";
  return "";
}

export function useAuthenticationActions({
  demoMode,
  loginEmail,
  loginPassword,
  passwordConfirmation,
  inviteToken,
  setLoginPassword,
  setPasswordConfirmation,
  setAuthBusy,
  setAuthError,
  setAuthNotice,
  setUserEmail,
  setIsProgramAdmin,
  setAuthStatus,
  guidePromptCheckedRef,
  handoffKey,
  loadCalendar,
  clearCalendarData,
  confirmMessage,
  services = defaultServices,
}: AuthenticationActionsOptions) {
  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      await services.login(normalizedAccountEmail(loginEmail), loginPassword);
    } catch {
      setAuthError(
        "Connexion impossible. Vérifiez l’adresse et le mot de passe. Pour une première connexion, activez d’abord le compte depuis l’e-mail d’invitation.",
      );
      setAuthBusy(false);
      return;
    }
    setLoginPassword("");
    try {
      await loadCalendar();
    } catch (error) {
      setAuthError(
        calendarErrorMessage(
          error,
          "La connexion a réussi, mais le planning n’a pas pu être chargé. Réessayez dans un instant.",
        ),
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function requestPasswordReset() {
    const email = normalizedAccountEmail(loginEmail);
    if (!validAccountEmail(email)) {
      setAuthError("Indiquez d’abord l’adresse e-mail de votre compte.");
      setAuthNotice("");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      if (!demoMode) await services.requestPasswordRecovery(email);
      setAuthNotice(
        "Si ce compte est activé, un e-mail vient d’être envoyé. Ouvrez son lien pour choisir un nouveau mot de passe. Vérifiez aussi les courriers indésirables.",
      );
    } catch {
      setAuthError(
        "L’e-mail de réinitialisation n’a pas pu être envoyé. Vérifiez votre connexion puis réessayez.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitPasswordReset(event: FormEvent) {
    event.preventDefault();
    const validationError = passwordValidationError(
      loginPassword,
      passwordConfirmation,
    );
    if (validationError) {
      setAuthError(validationError);
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      await services.updatePassword(loginPassword);
      setLoginPassword("");
      setPasswordConfirmation("");
      await loadCalendar();
      confirmMessage("Votre nouveau mot de passe est enregistré.");
    } catch (error) {
      setAuthError(
        calendarErrorMessage(
          error,
          "Le mot de passe n’a pas pu être modifié. Le lien a peut-être expiré : demandez-en un nouveau.",
        ),
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    const validationError = passwordValidationError(loginPassword);
    if (validationError) {
      setAuthError(validationError);
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      const user = await services.acceptInvite(inviteToken, loginPassword);
      setUserEmail(user.email || "Compte connecté");
      if (user.email)
        localStorage.setItem(
          `planning:guide-pending-v1:${normalizedAccountEmail(user.email)}`,
          "1",
        );
      history.replaceState({}, "", location.pathname);
      setLoginPassword("");
      setPasswordConfirmation("");
      await loadCalendar();
    } catch {
      setAuthError("Cette invitation est invalide ou a expiré.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function disconnect() {
    await services.logout();
    localStorage.removeItem(handoffKey);
    guidePromptCheckedRef.current = false;
    clearCalendarData();
    setUserEmail("");
    setIsProgramAdmin(false);
    setAuthStatus("guest");
  }

  return {
    submitLogin,
    requestPasswordReset,
    submitPasswordReset,
    submitInvite,
    disconnect,
  };
}
