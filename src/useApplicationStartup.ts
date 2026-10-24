import { useEffect, useEffectEvent, type Dispatch, type SetStateAction } from "react";
import { getUser, handleAuthCallback } from "@netlify/identity";
import {
  emptyEntry,
  rangeKeys,
  type FormProfile,
  type LeavePeriod,
  type PayProfile,
} from "./appModel";
import { CalendarApiError, getCalendar, notifyGuestSession } from "./calendarApi";
import { parseCalendarSnapshot } from "./calendarPayload";
import { parseDemoCompletedRequestJson } from "./demoCompletedRequest";
import { DEMO_PAY_PROFILE, demoPayProfiles } from "./demoPayProfile";
import {
  recoveryRequestMinutes,
  type RecoveryRequestType,
  type RecoveryUse,
  type WorkQuota,
} from "./overtime";
import { addDays, dateKey, halfMomentFromStart, localDate } from "./planningLogic";
import {
  forgetSessionAtNewLaunch,
  installSessionRenewal,
  keepSessionBackup,
  markSessionLaunch,
  readCalendarSnapshot,
  renewSession,
  restoreRememberedSession,
  saveCalendarSnapshot,
} from "./rememberedSession";
import type { useAuthUiState } from "./useAuthUiState";
import type { useCalendarDataState } from "./useCalendarDataState";
import { readDemoExchanges } from "./useWorkExchangeActions";
import { exchangeEntryFields } from "./workExchange";

type AuthUiState = ReturnType<typeof useAuthUiState>;
type CalendarDataState = ReturnType<typeof useCalendarDataState>;

type ApplicationStartupOptions = {
  demoMode: boolean;
  /** En développement, la démo locale ouvre avec le rôle d'administrateur. */
  localDemoAdmin: boolean;
  authUi: Pick<
    AuthUiState,
    "authStatus" | "setAuthStatus" | "setUserEmail" | "setIsProgramAdmin" | "setInviteToken"
    | "setLoginEmail" | "setLoginPassword" | "setPasswordConfirmation" | "setAuthError"
  >;
  calendarData: Pick<
    CalendarDataState,
    "setEntries" | "setPeriods" | "setFormProfile" | "setPayProfiles" | "setOvertimeEntries"
    | "setRecoveryUses" | "setMecenatEntries" | "setMecenatSignups" | "setPartnerEntries" | "setPartnerPeriods" | "setPartnerSharingStatus"
  >;
  setNow: Dispatch<SetStateAction<Date>>;
  setView: Dispatch<SetStateAction<Date>>;
  setGroup: Dispatch<SetStateAction<number>>;
  confirm: (message: string) => void;
};

/**
 * L'ouverture de l'application : la démo sans compte (jeu de données local,
 * demande terminée dans le formulaire, échanges), sinon le lien
 * d'authentification, le planning gardé sur l'appareil affiché aussitôt, la
 * vérification de la session puis la relecture du planning sur le serveur,
 * rejouée au retour dans l'application.
 */
export function useApplicationStartup({
  demoMode,
  localDemoAdmin,
  authUi,
  calendarData,
  setNow,
  setView,
  setGroup,
  confirm,
}: ApplicationStartupOptions) {
  const {
    authStatus, setAuthStatus, setUserEmail, setIsProgramAdmin, setInviteToken,
    setLoginEmail, setLoginPassword, setPasswordConfirmation, setAuthError,
  } = authUi;
  const {
    setEntries, setPeriods, setFormProfile, setPayProfiles, setOvertimeEntries,
    setRecoveryUses, setMecenatEntries, setMecenatSignups, setPartnerEntries, setPartnerPeriods, setPartnerSharingStatus,
  } = calendarData;

  const initializeApplication = useEffectEvent(async () => {
      const actualToday = new Date();
      setNow(actualToday);
      setView(localDate(actualToday.getFullYear(), actualToday.getMonth(), 1));
      if (demoMode) {
        if (import.meta.env.DEV) {
          const dates = [1, 2, 3].map((days) => dateKey(addDays(actualToday, days)));
          setEntries((current) => ({
            ...current,
            [dates[0]]: { ...emptyEntry(), noteText: "Préparer les documents pour notre rendez-vous", noteColor: "#d65e68", noteUpdatedAt: new Date().toISOString() },
            [dates[1]]: { ...emptyEntry(), noteText: "Penser à appeler le médecin", noteColor: "#d65e68", noteUpdatedAt: new Date().toISOString() },
          }));
          setPartnerEntries((current) => ({
            ...current,
            [dates[0]]: { noteText: "Je réserve la table pour 19 h 30", noteColor: "#f2c84b", noteAuthor: "agnes", noteUpdatedAt: new Date().toISOString(), noteGroupId: "", agnesLeave: false },
            [dates[2]]: { noteText: "Récupérer le colis après le travail", noteColor: "#f2c84b", noteAuthor: "agnes", noteUpdatedAt: new Date().toISOString(), noteGroupId: "", agnesLeave: false },
          }));
        }
        try {
          const seededProfile = JSON.parse(
            localStorage.getItem("planning:e2e-pay-profile") || "null",
          ) as FormProfile | null;
          const seededPayProfiles = JSON.parse(
            localStorage.getItem("planning:e2e-pay-profiles") || "null",
          ) as Record<string, PayProfile> | null;
          // La démo de prévisualisation reçoit un profil de paie fictif, pour
          // montrer de vrais montants ; les tests gardent une démo sans profil.
          const demoProfileWanted = import.meta.env.DEV && import.meta.env.VITE_DEMO_PAY_PROFILE === "true";
          if (seededProfile) setFormProfile(seededProfile);
          else if (demoProfileWanted) setFormProfile(DEMO_PAY_PROFILE);
          if (seededPayProfiles) setPayProfiles(seededPayProfiles);
          else if (demoProfileWanted) setPayProfiles(demoPayProfiles(actualToday.getFullYear()));
          const completed = parseDemoCompletedRequestJson(
            localStorage.getItem("planning:demo-completed-request-v1"),
          );
          if (completed?.requestId) {
            if (completed.requestKind === "recovery") {
              const quota: WorkQuota = completed.profile.workQuota;
              const recoverySelections: Array<{
                date: string;
                type: RecoveryRequestType;
                start: string;
                end: string;
              }> = [
                ...completed.periods.flatMap((item) =>
                  item.type === "recovery_day"
                    ? rangeKeys(item.from, item.to || item.from).map((date) => ({
                        date,
                        type: "recovery_day" as const,
                        start: "",
                        end: "",
                      }))
                    : [],
                ),
                ...completed.timed.map((item) => ({
                    date: item.date,
                    type: item.type,
                    start: item.start || "",
                    end: item.end || "",
                  })),
              ];
              const mappedUses: RecoveryUse[] = recoverySelections.map(
                (item, index) => ({
                  id: `${completed.requestId}-recovery-${index + 1}`,
                  date: item.date,
                  minutes: recoveryRequestMinutes(
                    item.type,
                    quota,
                    item.start,
                    item.end,
                  ),
                  start: item.start || undefined,
                  end: item.end || undefined,
                  kind: item.type === "recovery_training" ? "training" : undefined,
                  updatedAt: new Date().toISOString(),
                }),
              );
              setRecoveryUses((current) => [
                ...current.filter(
                  (item) => !item.id.startsWith(`${completed.requestId}-recovery-`),
                ),
                ...mappedUses,
              ]);
            } else {
              const mapped: LeavePeriod[] = [
                ...completed.periods.map((item, index) => ({
                  id: `${completed.requestId}-${index + 1}`,
                  from: item.from,
                  to: item.to || item.from,
                  leaveType: item.type,
                  group: completed.group,
                  updatedAt: new Date().toISOString(),
                })),
                ...completed.timed.map((item, index) => ({
                    id: `${completed.requestId}-timed-${index + 1}`,
                    from: item.date,
                    to: item.date,
                    leaveType: "half" as const,
                    halfMoment: item.halfMoment || halfMomentFromStart(item.start || "13:30"),
                    ...(item.halfBalance ? { halfBalance: item.halfBalance } : {}),
                    group: completed.group,
                    updatedAt: new Date().toISOString(),
                  })),
              ];
              setPeriods((current) => [
                ...current.filter((item) => !item.id.startsWith(completed.requestId)),
                ...mapped,
              ]);
            }
            localStorage.removeItem("planning:demo-completed-request-v1");
          }
        } catch {}
        // Les échanges de la démo reviennent après l'ouverture du formulaire.
        const demoExchanges = readDemoExchanges();
        if (demoExchanges.length)
          setEntries((current) => {
            const next = { ...current };
            for (const item of demoExchanges)
              for (const [date, fields] of Object.entries(exchangeEntryFields(item)))
                next[date] = { ...(next[date] || emptyEntry()), ...fields };
            return next;
          });
        setUserEmail("demo@demo.local");
        setIsProgramAdmin(import.meta.env.DEV && localDemoAdmin);
        setAuthStatus("ready");
        if (new URLSearchParams(location.search).get("request") === "saved")
          confirm("La demande est enregistrée : le planning et les soldes sont à jour.");
        return;
      }
      /* Les liens d'invitation et de récupération portent leur jeton dans
         l'adresse. Une fois consommé, il ne vaut plus rien : le laisser
         traîner fait échouer le rechargement suivant sur un jeton mort. */
      const lienAuthentification = /(?:access|invite|recovery|confirmation|email_change)_token=/.test(location.hash);
      const nettoyerLien = () => {
        if (lienAuthentification) history.replaceState({}, "", location.pathname + location.search);
      };
      // Planning gardé sur l'appareil, affiché dès l'ouverture.
      let showingSnapshot = false;
      try {
        // Sans « Rester connecté », une nouvelle ouverture redemande la
        // connexion ; sinon, un jeton expiré pendant la veille est renouvelé
        // à la première réponse « connexion requise ».
        forgetSessionAtNewLaunch();
        installSessionRenewal();
        const callback = await handleAuthCallback();
        if (callback?.type === "invite" && callback.token) {
          setInviteToken(callback.token);
          setAuthStatus("invite");
          return;
        }
        if (callback?.type === "recovery" && callback.user) {
          setUserEmail(callback.user.email || "Compte connecté");
          setLoginEmail(callback.user.email || "");
          setLoginPassword("");
          setPasswordConfirmation("");
          nettoyerLien();
          setAuthStatus("recovery");
          return;
        }
        // « Rester connecté » : le cookie effacé à la fermeture est recréé
        // depuis la session gardée, puis le jeton est renouvelé s'il a expiré.
        restoreRememberedSession();
        // Ouverture immédiate : le dernier planning gardé s'affiche tout de
        // suite, pendant que la connexion est vérifiée et le serveur relu.
        const snapshot = readCalendarSnapshot();
        if (snapshot) {
          try {
            applyCalendarData(parseCalendarSnapshot(snapshot.data));
            setIsProgramAdmin(snapshot.isAdmin);
            showingSnapshot = true;
          } catch {}
        }
        const user = await getUser();
        if (!user) {
          if (showingSnapshot) clearCalendarData();
          setAuthStatus("guest");
          return;
        }
        await renewSession();
        setUserEmail(user.email || "Compte connecté");
        // Une saisie faite pendant la relecture peut manquer à sa réponse :
        // le planning est alors relu une seconde fois.
        let savedMeanwhile = false;
        const noteSave = (event: Event) => {
          if ((event as CustomEvent<{ status?: string }>).detail?.status === "saved") savedMeanwhile = true;
        };
        window.addEventListener("calendar-sync", noteSave);
        try {
          await loadCalendar();
          if (savedMeanwhile) await loadCalendar();
        } finally {
          window.removeEventListener("calendar-sync", noteSave);
        }
        if (new URLSearchParams(location.search).get("request") === "saved") {
          confirm("La demande est enregistrée : le planning et les soldes sont à jour.");
          history.replaceState({}, "", location.pathname);
        }
      } catch {
        // Sans réseau, le planning gardé reste affiché.
        if (showingSnapshot && !lienAuthentification) return;
        nettoyerLien();
        setAuthStatus("guest");
        setAuthError(
          lienAuthentification
            ? "Ce lien a déjà été utilisé ou a expiré. Demandez-en un nouveau depuis « Mot de passe oublié ? »."
            : "La connexion n’a pas pu être vérifiée. Réessayez.",
        );
      }
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void initializeApplication();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  async function loadCalendar() {
    let raw: unknown;
    try {
      raw = await getCalendar<unknown>();
    } catch (error) {
      if (error instanceof CalendarApiError && error.status === 401) {
        setAuthStatus("guest");
        return;
      }
      throw error;
    }
    const data = parseCalendarSnapshot(raw);
    void notifyGuestSession().catch(() => undefined);
    applyCalendarData(data);
    saveCalendarSnapshot(raw);
  }
  /** Affiche un planning lu sur le serveur ou gardé sur l'appareil. */
  function applyCalendarData(data: ReturnType<typeof parseCalendarSnapshot>) {
    setUserEmail(data.email);
    const syncedProfile = data.formProfile;
    setFormProfile(syncedProfile);
    setPayProfiles(data.payProfiles);
    if ([1, 2, 3].includes(Number(syncedProfile?.group)))
      setGroup(Number(syncedProfile?.group));
    setEntries(data.entries);
    setOvertimeEntries(data.overtimeEntries);
    setRecoveryUses(data.recoveryUses);
    setMecenatEntries(data.mecenatEntries);
    setMecenatSignups(data.mecenatSignups);
    setPartnerEntries(data.partnerEntries);
    setPartnerPeriods(data.partnerPeriods);
    setPartnerSharingStatus(data.partnerSharingStatus);
    setAuthStatus("ready");
    setPeriods(data.periods);
  }
  function clearCalendarData() {
    setEntries({});
    setPeriods([]);
    setOvertimeEntries([]);
    setRecoveryUses([]);
    setMecenatEntries([]);
    setMecenatSignups([]);
    setFormProfile(null);
    setPayProfiles({});
    setPartnerEntries({});
    setPartnerPeriods([]);
    setPartnerSharingStatus("disabled");
  }
  const reloadCalendar = useEffectEvent(() => loadCalendar());
  useEffect(() => {
    if (authStatus !== "ready" || demoMode) return;
    markSessionLaunch();
    keepSessionBackup();
    let lastRefresh = 0;
    // Au retour dans l'application, le jeton expiré pendant la veille est
    // renouvelé avant de relire le planning.
    const refreshSharedData = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh < 5_000) return;
      lastRefresh = Date.now();
      void renewSession()
        .then(() => reloadCalendar())
        .catch(() => undefined);
    };
    window.addEventListener("focus", refreshSharedData);
    document.addEventListener("visibilitychange", refreshSharedData);
    return () => {
      window.removeEventListener("focus", refreshSharedData);
      document.removeEventListener("visibilitychange", refreshSharedData);
    };
  }, [authStatus, demoMode]);

  return { loadCalendar, clearCalendarData };
}
