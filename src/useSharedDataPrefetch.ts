import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useColleagueGenders } from "./colleagueGenders";
import { getColleagueGroups, refreshColleagueGenders } from "./colleagueSharingApi";
import { getUsefulContacts } from "./contactsApi";
import { getSharedGrandPalaisProgram } from "./grandPalaisProgramApi";
import { saveSnapshotAdmin } from "./rememberedSession";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { useAuthUiState } from "./useAuthUiState";

type SharedDataPrefetchOptions = {
  authStatus: ReturnType<typeof useAuthUiState>["authStatus"];
  demoMode: boolean;
  /** La démonstration publique, limitée dans le temps. */
  publicDemoAccess: { active: boolean };
  /** En développement, la démo locale ouvre avec le rôle d'administrateur. */
  localDemoAdmin: boolean;
  setIsProgramAdmin: ReturnType<typeof useAuthUiState>["setIsProgramAdmin"];
  setProgramAdminKnown: Dispatch<SetStateAction<boolean>>;
  appShellUi: Pick<ReturnType<typeof useAppShellUiState>, "setApprovedGrandPalaisUpdates" | "setPrefetchedContacts">;
};

/**
 * Ce qui est relu dès que le compte est connecté : les genres des collègues,
 * la programmation du Grand Palais et le rôle d'administrateur qui vient
 * avec, les contacts utiles et les groupes de collègues, pour que ces écrans
 * s'ouvrent sans attendre.
 */
export function useSharedDataPrefetch({
  authStatus,
  demoMode,
  publicDemoAccess,
  localDemoAdmin,
  setIsProgramAdmin,
  setProgramAdminKnown,
  appShellUi,
}: SharedDataPrefetchOptions) {
  const { setApprovedGrandPalaisUpdates, setPrefetchedContacts } = appShellUi;
  // Genres des collègues renseignés dans les groupes : relus à l'ouverture,
  // ils accordent « vous le/la remplacez » dans les échanges.
  useColleagueGenders();
  useEffect(() => {
    if (authStatus !== "ready" || demoMode || publicDemoAccess.active) return;
    void refreshColleagueGenders().catch(() => undefined);
  }, [authStatus, demoMode, publicDemoAccess.active]);

  useEffect(() => {
    if (authStatus !== "ready" || publicDemoAccess.active) return;
    let active = true;
    void getSharedGrandPalaisProgram()
      .then((payload) => {
        if (!active) return;
        setApprovedGrandPalaisUpdates(payload.approved ?? []);
        setIsProgramAdmin(import.meta.env.DEV && demoMode ? localDemoAdmin : payload.isAdmin);
        if (!demoMode) saveSnapshotAdmin(payload.isAdmin === true);
        setProgramAdminKnown(true);
      })
      .catch(() => {
        if (!active) return;
        // Sans réseau, le rôle gardé avec le planning reste en place.
        setIsProgramAdmin((current) => demoMode ? import.meta.env.DEV && localDemoAdmin : current);
        setProgramAdminKnown(true);
      });
    return () => { active = false; };
  }, [authStatus, demoMode, localDemoAdmin, publicDemoAccess.active, setApprovedGrandPalaisUpdates, setIsProgramAdmin, setProgramAdminKnown]);

  useEffect(() => {
    const expiresAt = import.meta.env.VITE_PUBLIC_DEMO_UNTIL;
    if (publicDemoAccess.active && expiresAt)
      localStorage.setItem("planning:public-demo-until", expiresAt);
  }, [publicDemoAccess.active]);
  useEffect(() => {
    if (authStatus !== "ready" || publicDemoAccess.active) return;
    let active = true;
    void getUsefulContacts()
      .then((payload) => {
        if (active) setPrefetchedContacts(payload);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authStatus, publicDemoAccess.active, setPrefetchedContacts]);
  useEffect(() => {
    if (authStatus !== "ready" || publicDemoAccess.active) return;
    void getColleagueGroups().catch(() => undefined);
  }, [authStatus, publicDemoAccess.active]);
}
