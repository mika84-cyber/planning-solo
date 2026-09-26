import { useMemo, useState } from "react";
import { absenceDateLabel, type AbsencePeriod, longAbsenceLetter, longAbsences } from "./longAbsence";

type LongAbsenceNoticeProps = {
  periods: readonly AbsencePeriod[];
  group: number;
  todayKey: string;
  sender: { fullName: string; job: string; group: number };
};

/** Une absence de 31 jours et plus demande une dérogation : l'application
 *  le signale et propose un courrier à la cheffe de service, à relire,
 *  compléter du motif puis copier. */
export function LongAbsenceNotice({ periods, group, todayKey, sender }: LongAbsenceNoticeProps) {
  // Absences de 31 jours consécutifs et plus, en cours ou à venir.
  const absences = useMemo(() => longAbsences(periods, group, todayKey), [periods, group, todayKey]);
  const [letter, setLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!absences.length) return null;
  return (
    <>
      {absences.map((absence) => (
        <aside className="long-absence-notice" key={absence.from} role="status">
          <p>
            <strong>Absence de {absence.days} jours consécutifs</strong>
            <span>
              Du {absenceDateLabel(absence.from)} au {absenceDateLabel(absence.to)}. Au-delà de 31 jours, une
              dérogation de la cheffe de service est nécessaire.
            </span>
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setCopied(false);
              setLetter(longAbsenceLetter(absence, sender, new Date()));
            }}
          >
            Rédiger le courrier
          </button>
        </aside>
      ))}
      {letter !== null ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setLetter(null)}>
          <section className="modal-card long-absence-letter" role="dialog" aria-modal="true" aria-labelledby="long-absence-letter-title">
            <button className="modal-close" type="button" onClick={() => setLetter(null)} aria-label="Fermer">×</button>
            <span className="step-label">Dérogation</span>
            <h2 id="long-absence-letter-title">Courrier à la cheffe de service</h2>
            <p>Relisez-le, précisez le motif, puis copiez-le dans un e-mail ou un document.</p>
            <textarea
              aria-label="Texte du courrier"
              value={letter}
              onChange={(event) => {
                setLetter(event.target.value);
                setCopied(false);
              }}
              rows={16}
            />
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setLetter(null)}>Fermer</button>
              <button
                className="save-button"
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(letter).then(() => setCopied(true), () => setCopied(false));
                }}
              >
                {copied ? "Copié" : "Copier le courrier"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
