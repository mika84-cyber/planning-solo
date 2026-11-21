import { useEffect, useMemo, useRef, useState } from "react";
import { computeExpoNotices, expoNoticeDetail, expoNoticeHeading } from "./expoNotices";
import { sanitizeExpoNoticesSeen } from "./expoNoticesSeen";
import { GRAND_PALAIS_PROGRAM, type GrandPalaisProgramData } from "./grandPalaisProgramData";
import { mergeSharedGrandPalaisProgram } from "./grandPalaisProgramMerge";
import type { SharedGrandPalaisEvent } from "./grandPalaisProgramTypes";
import "./expoHomeNotices.css";

type Props = {
  todayKey: string;
  /** Où cet appareil retient ses « Compris ». */
  storageKey: string;
  program?: GrandPalaisProgramData;
  /** Ce que l'administrateur a validé dans la veille du site officiel : une
   *  date corrigée, une exposition retirée, un espace que l'application ne
   *  livre pas (la Galerie 6.1). Lu au démarrage ; avant son arrivée, ou hors
   *  connexion, le programme livré sert seul. */
  approved?: SharedGrandPalaisEvent[];
  /** Les annonces déjà lues sur le compte, depuis n'importe quel appareil ;
   *  absent en démo et pour un compte sans profil, qui n'ont que l'appareil. */
  accountSeen?: string[];
  /** Range sur le compte les annonces lues sur cet appareil. */
  onSeen?: (ids: string[]) => unknown;
};

function readSeen(storageKey: string): string[] {
  try {
    return sanitizeExpoNoticesSeen(JSON.parse(localStorage.getItem(storageKey) || "[]"));
  } catch {
    return [];
  }
}

/**
 * À l'ouverture de l'accueil, pour tous les comptes, dans une fenêtre : une
 * exposition des galeries, du Palais des enfants ou de la Nef, la veille de
 * son ouverture puis une semaine avant sa fin (demandes de l'administrateur,
 * le 21 novembre 2026 ; d'abord une carte en haut de l'accueil, il a préféré
 * une fenêtre). « Compris », son seul bouton (Échap le presse), la referme
 * et fait taire le message, sur le téléphone comme sur l'ordinateur ; une
 * annonce nouvelle la rouvre, avec elle seule.
 */
export function ExpoHomeNotices({ todayKey, storageKey, program = GRAND_PALAIS_PROGRAM, approved, accountSeen, onSeen }: Props) {
  const [local, setLocal] = useState(() => readSeen(storageKey));
  const current = useMemo(() => (approved?.length ? mergeSharedGrandPalaisProgram(program, approved) : program), [program, approved]);
  const notices = computeExpoNotices(current, todayKey)
    .filter((notice) => !local.includes(notice.id) && !accountSeen?.includes(notice.id));
  // Un « Compris » que le compte n'a pas encore (à l'instant, ou donné hors
  // connexion) lui est envoyé, une fois par visite de l'accueil.
  const pending = accountSeen ? sanitizeExpoNoticesSeen(local, todayKey).filter((id) => !accountSeen.includes(id)).join("|") : "";
  const sent = useRef("");
  useEffect(() => {
    if (!pending || sent.current === pending) return;
    sent.current = pending;
    void onSeen?.(pending.split("|"));
  }, [pending, onSeen]);
  if (!notices.length) return null;
  const acknowledge = () => {
    // Les annonces passées ne servent plus : seules restent celles en cours.
    const next = sanitizeExpoNoticesSeen([...local, ...notices.map((notice) => notice.id)], todayKey);
    setLocal(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Écarté pour cette visite seulement. */ }
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card expo-notices" role="dialog" aria-modal="true" aria-labelledby="expo-notices-title">
        <span className="step-label" id="expo-notices-title">Expositions</span>
        <ul>
          {notices.map((notice) => {
            const detail = expoNoticeDetail(notice);
            return (
              <li key={notice.id} className={notice.kind}>
                <strong>{expoNoticeHeading(notice)}</strong>
                <span>{notice.venueLabel} · {notice.title}</span>
                {detail ? <small>{detail}</small> : null}
              </li>
            );
          })}
        </ul>
        <div className="modal-actions">
          <button type="button" className="primary-action" data-modal-close onClick={acknowledge}>Compris</button>
        </div>
      </section>
    </div>
  );
}

export default ExpoHomeNotices;
