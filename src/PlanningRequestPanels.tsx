import { useState, type CSSProperties } from "react";
import "./requestChoiceFamilies.css";
import { minutesLabel } from "./overtime";
import type { RequestKind } from "./appModel";
import {
  GROUP_OPTIONS,
  TYPE_COLORS,
  fromKey,
  longDate,
  type SelectionType,
} from "./planningLogic";

/** Bandeau de préparation d'une note posée sur plusieurs dates. */
export function NoteSelectionPanel({
  open,
  noteColor,
  noteText,
  noteDates,
  savingDay,
  onCancel,
  onSave,
}: {
  open: boolean;
  noteColor: string;
  noteText: string;
  noteDates: string[];
  savingDay: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!open) return null;

  return (
    <section
      className="request-panel calendar-request-panel"
      id="note-selection-panel"
      style={{ "--active-color": noteColor } as CSSProperties}
    >
      <div className="request-heading">
        <div>
          <span className="step-label">Note en préparation</span>
          <h2>Choisir plusieurs dates</h2>
        </div>
        <button className="text-button danger" type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
      <p className="request-help">{noteText}</p>
      <div className="request-bottom">
        <p>
          <strong>{noteDates.length}</strong>{" "}
          {noteDates.length > 1 ? "dates sélectionnées" : "date sélectionnée"}.
          Cliquez sur une date colorée pour la retirer.
        </p>
        <button
          className="validate-button"
          type="button"
          onClick={onSave}
          disabled={!noteDates.length || !noteText.trim() || savingDay}
        >
          {savingDay ? "Synchronisation…" : "Enregistrer la note"}
        </button>
      </div>
    </section>
  );
}

/** Invite à toucher une date du calendrier pour situer une récupération. */
export function RecoveryDatePickingPanel({
  open,
  onCancel,
}: {
  open: boolean;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <section className="request-panel recovery-date-picking-panel" aria-label="Sélection de la date de récupération">
      <div>
        <span className="step-label">Récupération</span>
        <h2>Sélectionnez une date dans le calendrier</h2>
        <p>Le cycle de votre groupe est affiché normalement. Touchez la date souhaitée pour continuer.</p>
      </div>
      <button className="text-button danger" type="button" onClick={onCancel}>
        Annuler la sélection
      </button>
    </section>
  );
}

/** Soldes montrés sous les types qui en ont un. */
export type RequestChooserBalances = {
  year: number;
  /** L'année n'est pas l'année en cours : elle est nommée. */
  otherYear: boolean;
  leave: Partial<Record<"annual" | "rtt" | "fraction", number>>;
  recoveryMinutes: number;
  /** Jours CET disponibles ; null sans compte ouvert. */
  cetDays: number | null;
};

function daysRemainingLabel(days: number | undefined, year: string) {
  if (days === undefined) return null;
  if (days <= 0) return `Aucun jour restant${year}`;
  const plural = days > 1 ? "s" : "";
  return `${days.toLocaleString("fr-FR")} jour${plural} restant${plural}${year}`;
}

/** Première étape d'une demande : ce que l'on pose avant de choisir les dates. */
export function RequestChooserDialog({
  open,
  requestChooserDate,
  balances,
  pendingWishCount = 0,
  onClose,
  onChoose,
  onChooseWish,
  onConvertWishes,
}: {
  open: boolean;
  requestChooserDate: string | null;
  /** Soldes restants, affichés à la place de la description. */
  balances?: RequestChooserBalances;
  /** Congés souhaités à venir, pas encore transformés en congé. Zéro
   *  lorsque la case touchée n'est pas elle-même un souhait. */
  pendingWishCount?: number;
  onClose: () => void;
  onChoose: (kind: RequestKind, requestedType: SelectionType) => void;
  onChooseWish?: () => void;
  onConvertWishes?: () => void;
}) {
  if (!open) return null;
  const inYear = balances?.otherYear ? ` en ${balances.year}` : "";
  const annualHint = daysRemainingLabel(balances?.leave.annual, inYear) || "Congés annuels";
  const rttHint = daysRemainingLabel(balances?.leave.rtt, inYear) || "Journée ou période";
  const fractionHint = daysRemainingLabel(balances?.leave.fraction, inYear) || "Jour de fractionnement";
  // Sans compte ouvert, le CET le dit simplement.
  const cetHint = !balances
    ? "Compte épargne-temps"
    : balances.cetDays === null
      ? "Pas de CET disponible"
      : balances.cetDays > 0
        ? `${balances.cetDays.toLocaleString("fr-FR")} jour${balances.cetDays > 1 ? "s" : ""} sur le CET`
        : "CET vide";
  const recoveryHint = balances
    ? balances.recoveryMinutes > 0
      ? `${minutesLabel(balances.recoveryMinutes)} disponible${balances.recoveryMinutes >= 120 ? "s" : ""}`
      : "Aucune heure disponible"
    : "À déduire de votre solde d’heures";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card request-choice"
        role="dialog"
        aria-modal="true"
        aria-label="Poser un congé"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Étape 1 sur 3</span>
        <h2 id="request-choice-title">Que voulez-vous poser&nbsp;?</h2>
        <p>
          {requestChooserDate
            ? `Choisissez le type à appliquer au ${longDate(fromKey(requestChooserDate))}. Vous pourrez encore le modifier ensuite.`
            : "Choisissez le type à poser, puis les dates dans le planning."}
        </p>
        {/* Tous les types visibles, en liste : une ligne par type, de même
            hauteur, avec ce qui puise dans un solde (et ce qu'il en reste)
            d'un côté, les absences et repères du planning de l'autre. */}
        <div className="request-choice-families">
          <section className="request-choice-family request-family-balance" aria-labelledby="request-family-balance">
            <h3 id="request-family-balance">Avec solde</h3>
            <div className="request-family-list">
              <button type="button" className="request-choice-row leave-choice-annual" onClick={() => onChoose("leave", "annual")}><i aria-hidden="true" /><strong>CA</strong><span>{annualHint}</span></button>
              <button type="button" className="request-choice-row leave-choice-rtt" onClick={() => onChoose("leave", "rtt")}><i aria-hidden="true" /><strong>RTT</strong><span>{rttHint}</span></button>
              <button type="button" className="request-choice-row leave-choice-fraction" onClick={() => onChoose("leave", "fraction")}><i aria-hidden="true" /><strong>Fractionnement</strong><span>{fractionHint}</span></button>
              <button type="button" className="request-choice-row leave-choice-cet" onClick={() => onChoose("leave", "cet")}><i aria-hidden="true" /><strong>CET</strong><span>{cetHint}</span></button>
              <button type="button" className="request-choice-row leave-choice-recovery" onClick={() => onChoose("recovery", "recovery_day")}><i aria-hidden="true" /><strong>Récupération</strong><span>{recoveryHint}</span></button>
            </div>
          </section>
          <section className="request-choice-family request-family-absence" aria-labelledby="request-family-absence">
            <h3 id="request-family-absence">Absences et repères</h3>
            <div className="request-family-list">
              <button type="button" className="request-choice-row leave-choice-sick" onClick={() => onChoose("leave", "sick")}><i aria-hidden="true" /><strong>Maladie</strong><span>Arrêt suivi</span></button>
              <button type="button" className="request-choice-row leave-choice-childcare" onClick={() => onChoose("leave", "childcare")}><i aria-hidden="true" /><strong>Garde d’enfant</strong><span>Absence exceptionnelle</span></button>
              <button type="button" className="request-choice-row leave-choice-exceptional" onClick={() => onChoose("leave", "exceptional")}><i aria-hidden="true" /><strong>Jour exceptionnel</strong><span>Selon votre situation</span></button>
              <button type="button" className="request-choice-row leave-choice-other" onClick={() => onChoose("other", "other")}><i aria-hidden="true" /><strong>Divers</strong><span>Jour non travaillé</span></button>
              <button type="button" className="request-choice-row leave-choice-strike" onClick={() => onChoose("strike", "strike")}><i aria-hidden="true" /><strong>Grève</strong><span>Retenue estimée</span></button>
            </div>
          </section>
          {/* Les souhaits ne se posent et ne se transforment qu'en partant
              d'une case du planning, jamais depuis « Poser un congé ». Sur grand
              écran, ils se rangent sous les absences et repères. */}
          {onChooseWish && requestChooserDate ? (
            <section className="request-wish-choices" aria-label="Congés souhaités">
              <button type="button" className="request-wish-choice" onClick={onChooseWish}>
                <strong>Congés souhaités</strong>
                <span>Ce jour et d’autres dates si besoin, sans formulaire ni solde</span>
              </button>
              {pendingWishCount && onConvertWishes ? (
                <button type="button" className="request-wish-choice request-wish-convert" onClick={onConvertWishes}>
                  <strong>Transformer mes souhaits <b>{pendingWishCount}</b></strong>
                  <span>En CA, RTT ou autre congé, au choix pour chaque date</span>
                </button>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Choix du groupe de travail, qui recalcule le planning sur-le-champ. */
export function GroupChooserDialog({
  open,
  group,
  onClose,
  onChange,
}: {
  open: boolean;
  group: number;
  onClose: () => void;
  onChange: (group: number) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card group-choice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-choice-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Cycle de travail</span>
        <h2 id="group-choice-title">Choisir mon groupe</h2>
        <p>Le planning se met à jour dès que vous choisissez.</p>
        <div className="group-choice-grid">
          {GROUP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`group-choice-${option.value}${group === option.value ? " active" : ""}`}
              aria-pressed={group === option.value}
              onClick={() => onChange(option.value)}
            >
              <span>Groupe</span>
              <strong>{option.value}</strong>
              {group === option.value ? <small className="group-choice-current">Actuel</small> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Nature choisie pour transformer un souhait. Une demi-journée porte son
 *  moment après « : ». Une ligne sans nature reste un souhait. */
export type WishChoice =
  | "annual"
  | "rtt"
  | "fraction"
  | "cet"
  | "childcare"
  | "exceptional"
  | "half:morning"
  | "half:afternoon";

/** Les trois natures courantes en boutons ; toutes les autres qu'accepte une
 *  demande de congé dans le menu « Autre ». Maladie, Divers et récupération
 *  ont leurs propres parcours et ne se mélangent pas à une demande de congé. */
const WISH_MAIN_CHOICES: ReadonlyArray<{ choice: WishChoice; label: string; short: string }> = [
  { choice: "annual", label: "CA", short: "CA" },
  { choice: "rtt", label: "RTT", short: "RTT" },
  { choice: "fraction", label: "FRA", short: "FRA" },
];
const WISH_OTHER_CHOICES: ReadonlyArray<{ choice: WishChoice; label: string; short: string }> = [
  { choice: "half:morning", label: "Demi-journée · matin", short: "demi-journée" },
  { choice: "half:afternoon", label: "Demi-journée · après-midi", short: "demi-journée" },
  { choice: "exceptional", label: "Jour exceptionnel", short: "jour exceptionnel" },
  { choice: "childcare", label: "Garde d’enfant", short: "garde d’enfant" },
  { choice: "cet", label: "CET", short: "CET" },
];
const WISH_CHOICES = [...WISH_MAIN_CHOICES, ...WISH_OTHER_CHOICES];

/** Type de sélection d'une nature choisie, pour sa couleur. */
export function wishChoiceType(choice: WishChoice): SelectionType {
  return choice.split(":")[0] as SelectionType;
}

function wishDateLabel(key: string) {
  return fromKey(key).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/** Décompte lisible : « 3 CA · 1 RTT · 2 gardés en souhait ». Un souhait
 *  du matin ou de l'après-midi compte comme une demi-journée de sa nature. */
export function wishConversionSummary(
  choices: Record<string, WishChoice | undefined>,
  total = Object.keys(choices).length,
  moments: Record<string, "morning" | "afternoon" | undefined> = {},
) {
  const counts = new Map<string, number>();
  let chosen = 0;
  for (const [date, choice] of Object.entries(choices)) {
    if (!choice) continue;
    chosen += 1;
    const short = WISH_CHOICES.find((item) => item.choice === choice)?.short || choice;
    const key = moments[date] ? `demi-journée ${short}` : short;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const order = [
    ...new Set([
      ...WISH_CHOICES.map((item) => item.short),
      ...WISH_MAIN_CHOICES.map((item) => `demi-journée ${item.short}`),
    ]),
  ];
  const kept = total - chosen;
  return [
    ...order.filter((short) => counts.get(short)).map((short) => `${counts.get(short)} ${short}`),
    ...(kept ? [`${kept} ${kept > 1 ? "gardés" : "gardé"} en souhait`] : []),
  ].join(" · ");
}

/** Transformer des congés souhaités : une ligne par souhait. On choisit la
 *  nature des souhaits à transformer ; une ligne laissée vide reste un
 *  souhait. « Tout en » règle toutes les lignes d'un geste. Les soldes sont
 *  contrôlés ensuite, à l'étape de vérification de la demande. */
export function WishConversionDialog({
  dates,
  moments = {},
  onClose,
  onContinue,
}: {
  dates: string[];
  /** Souhaits du matin ou de l'après-midi : ils deviennent une demi-journée
   *  de CA, RTT ou FRA au même moment. */
  moments?: Record<string, "morning" | "afternoon" | undefined>;
  onClose: () => void;
  onContinue: (choices: Record<string, WishChoice>) => void;
}) {
  const [choices, setChoices] = useState<Record<string, WishChoice | undefined>>({});
  const toConvert = dates.filter((date) => choices[date]);
  const allSame = (choice: WishChoice) => dates.every((date) => choices[date] === choice);
  const setChoice = (date: string, choice: WishChoice | undefined) =>
    setChoices((previous) => ({ ...previous, [date]: choice }));
  const setAll = (choice: WishChoice) =>
    setChoices(allSame(choice) ? {} : Object.fromEntries(dates.map((date) => [date, choice])));
  const chip = (choice: WishChoice, label: string, active: boolean, onClick: () => void, name: string) => (
    <button
      key={choice}
      type="button"
      className={active ? "active" : ""}
      aria-pressed={active}
      aria-label={name}
      style={{ "--type-color": TYPE_COLORS[wishChoiceType(choice)] } as CSSProperties}
      onClick={onClick}
    >
      {label}
    </button>
  );
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card wish-conversion"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wish-conversion-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Congés souhaités</span>
        <h2 id="wish-conversion-title">
          {dates.length > 1 ? `Transformer ${dates.length} souhaits` : "Transformer ce souhait"}
        </h2>
        <p>Choisissez la nature des souhaits à transformer. Une ligne laissée vide reste un souhait. Vos soldes seront vérifiés à l’étape suivante.</p>
        {dates.length > 1 ? (
          <div className="wish-conversion-all">
            <span>Tout en :</span>
            <div className="wish-conversion-chips" role="group" aria-label="Appliquer une nature à tous les souhaits">
              {WISH_MAIN_CHOICES.map(({ choice, label }) =>
                chip(choice, label, allSame(choice), () => setAll(choice), `Tout en ${label}`),
              )}
            </div>
          </div>
        ) : null}
        <ul className="wish-conversion-list">
          {dates.map((date) => {
            const current = choices[date];
            const longLabel = longDate(fromKey(date));
            const otherSelected = WISH_OTHER_CHOICES.some(({ choice }) => choice === current);
            const moment = moments[date];
            return (
              <li key={date} className={current ? undefined : "kept"}>
                <span className="wish-conversion-date">
                  {wishDateLabel(date)}
                  {moment ? <small>{moment === "morning" ? "matin" : "après-midi"}</small> : null}
                </span>
                <div className="wish-conversion-chips" role="group" aria-label={`Nature du ${longLabel}`}>
                  {WISH_MAIN_CHOICES.map(({ choice, label }) =>
                    chip(
                      choice,
                      label,
                      current === choice,
                      () => setChoice(date, current === choice ? undefined : choice),
                      `${label} le ${longLabel}`,
                    ),
                  )}
                  {moment ? null : <select
                    className={otherSelected ? "active" : ""}
                    style={otherSelected && current ? ({ "--type-color": TYPE_COLORS[wishChoiceType(current)] } as CSSProperties) : undefined}
                    aria-label={`Autre nature le ${longLabel}`}
                    value={otherSelected ? current : ""}
                    onChange={(event) => setChoice(date, (event.target.value || undefined) as WishChoice | undefined)}
                  >
                    <option value="">Autre</option>
                    {WISH_OTHER_CHOICES.map(({ choice, label }) => (
                      <option key={choice} value={choice}>{label}</option>
                    ))}
                  </select>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="wish-conversion-summary" aria-live="polite">
          {toConvert.length ? wishConversionSummary(choices, dates.length, moments) : "Aucune nature choisie : tout reste en souhait."}
        </p>
        <button
          className="validate-button wish-conversion-continue"
          type="button"
          disabled={!toConvert.length}
          onClick={() => onContinue(Object.fromEntries(toConvert.map((date) => [date, choices[date] as WishChoice])))}
        >
          {!toConvert.length
            ? "Choisissez au moins une nature"
            : toConvert.length === dates.length
              ? "Continuer"
              : `Continuer avec ${toConvert.length} ${toConvert.length > 1 ? "congés" : "congé"}`}
        </button>
      </section>
    </div>
  );
}
