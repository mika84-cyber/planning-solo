import { useState } from "react";
import type { AuthStatus } from "./appModel";

/** État strictement visuel du parcours d’authentification. */
export function useAuthUiState() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [userEmail, setUserEmail] = useState("");
  const [isProgramAdmin, setIsProgramAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  return {
    authStatus,
    setAuthStatus,
    userEmail,
    setUserEmail,
    isProgramAdmin,
    setIsProgramAdmin,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    passwordConfirmation,
    setPasswordConfirmation,
    inviteToken,
    setInviteToken,
    authBusy,
    setAuthBusy,
    authError,
    setAuthError,
    authNotice,
    setAuthNotice,
  };
}
