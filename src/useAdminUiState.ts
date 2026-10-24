import { useState } from "react";

/**
 * Les états d'interface de l'administrateur, regroupés hors d'App.tsx :
 * l'aperçu invité, le panneau d'outils, le compteur qui fait relire les
 * données après une action, et la connaissance du statut.
 */
export function useAdminUiState() {
  const [guestPreview, setGuestPreview] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [adminRevision, setAdminRevision] = useState(0);
  // Le statut d'administrateur arrive avec la programmation GP : tant qu'il
  // n'est pas connu, rien de réservé aux invités ne s'affiche.
  const [programAdminKnown, setProgramAdminKnown] = useState(false);
  return {
    guestPreview, setGuestPreview,
    adminToolsOpen, setAdminToolsOpen,
    adminRevision, setAdminRevision,
    programAdminKnown, setProgramAdminKnown,
  };
}
