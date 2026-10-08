import { euros } from "./appModel";
import type { MecenatEntry } from "./mecenat";
import { minutesLabel, overtimePayPeriod, type OvertimeEntry, type RecoveryUse } from "./overtime";
import { MONTHS, fromKey } from "./planningLogic";
import "./workTimeHistory.css";

/* Historique des heures sup, récupérations et mécénats : regroupé par mois,
   une ligne par élément — la date à gauche, ce que c'est au centre, la
   valeur à droite (ce qui s'ajoute en vert, ce qui se retire en rouge). */

type HistoryRowProps = {
  date: string;
  tone: "gain" | "use" | "paid" | "mecenat";
  title: string;
  /** Étiquette qui dit ce que deviennent les heures : payées ou récupérées. */
  badge?: { label: string; tone: "paid" | "recovery" };
  detail: string;
  status?: string;
  statusTone?: "left";
  value: string;
  deleteLabel: string;
  deleteText: string;
  onDelete?: () => void;
};

function HistoryRow({ date, tone, title, badge, detail, status, statusTone, value, deleteLabel, deleteText, onDelete }: HistoryRowProps) {
  const day = fromKey(date);
  const weekday = day.toLocaleDateString("fr-FR", { weekday: "short" });
  return (
    <article className={`history-row tone-${tone}`}>
      <span className="history-date" aria-hidden="true">
        <b>{day.getDate()}</b>
        <small>{weekday}</small>
      </span>
      <div className="history-main">
        <strong>
          {title}
          {badge ? <em className={`history-badge ${badge.tone}`}>{badge.label}</em> : null}
        </strong>
        <span className="overtime-history-detail">{detail}</span>
        {status ? <small className={statusTone === "left" ? "overtime-history-left" : undefined}>{status}</small> : null}
      </div>
      <span className="history-value">{value}</span>
      {onDelete ? (
        <button type="button" className="history-delete" onClick={onDelete} aria-label={`${deleteText} : ${deleteLabel}`}>
          {deleteText}
        </button>
      ) : null}
    </article>
  );
}

/** « 18 h – 20 h 30 ». */
function rangeLabel(start?: string, end?: string) {
  if (!start || !end) return "";
  const clock = (value: string) => value.replace(/^0(?=\d)/, "").replace(":00", " h").replace(":", " h ");
  return `${clock(start)} – ${clock(end)}`;
}

function fullDate(key: string) {
  return fromKey(key).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Les éléments regroupés par mois, du plus récent au plus ancien, ou dans
 *  l'ordre que donne `compare` (les mois suivent leur premier élément). */
export function groupByMonth<T extends { date: string }>(
  items: T[],
  compare: (a: T, b: T) => number = (a, b) => b.date.localeCompare(a.date),
) {
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  for (const item of [...items].sort(compare)) {
    const key = item.date.slice(0, 7);
    let group = groups.find((candidate) => candidate.key === key);
    if (!group) {
      const label = `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
      group = { key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** Le mois de paie est passé : les heures sont réputées payées. */
function isPaidAlready(pay: { year: number; month: number }) {
  const now = new Date();
  return pay.year * 12 + pay.month < now.getFullYear() * 12 + now.getMonth();
}

/** « Paiement : 2 h 30 · Récupération : 3 h 45 » pour l'en-tête du mois. */
function monthSummary(items: WorkTimeHistoryItem[]) {
  let paid = 0;
  let recovered = 0;
  for (const item of items) {
    if (item.kind === "paid") paid += item.entry.minutes;
    if (item.kind === "gain" && !item.entry.id.startsWith("solidarity-")) recovered += item.entry.minutes;
  }
  return [paid ? `Paiement : ${minutesLabel(paid)}` : "", recovered ? `Récupération : ${minutesLabel(recovered)}` : ""].filter(Boolean).join(" · ");
}

export type WorkTimeHistoryItem =
  | { date: string; kind: "gain" | "paid" | "holiday"; entry: OvertimeEntry }
  | { date: string; kind: "use"; entry: RecoveryUse };

export function WorkTimeHistoryList({
  items,
  earningStates,
  onDeleteOvertime,
  onDeleteRecoveryUse,
}: {
  items: WorkTimeHistoryItem[];
  earningStates: Map<string, { earnedMinutes: number; remainingMinutes: number }>;
  onDeleteOvertime: (entry: OvertimeEntry) => void;
  onDeleteRecoveryUse: (entry: RecoveryUse) => void;
}) {
  return (
    <>
      {groupByMonth(items).map((group) => (
        <section key={group.key} className="history-month" aria-label={group.label}>
          <h4>
            {group.label}
            <small>{monthSummary(group.items)}</small>
          </h4>
          {group.items.map((item) => {
            if (item.kind === "use") {
              const entry = item.entry;
              const training = entry.kind === "training";
              return (
                <HistoryRow
                  key={entry.id}
                  date={entry.date}
                  tone="use"
                  title={training ? "Formation" : "Récupération posée"}
                  detail={[rangeLabel(entry.start, entry.end), training ? "Déduite du solde" : "Récupération consommée"].filter(Boolean).join(" · ")}
                  value={`− ${minutesLabel(entry.minutes)}`}
                  deleteText="Annuler"
                  deleteLabel={fullDate(entry.date)}
                  onDelete={() => onDeleteRecoveryUse(entry)}
                />
              );
            }
            const entry = item.entry;
            const state = earningStates.get(entry.id);
            if (item.kind === "holiday") {
              return (
                <HistoryRow
                  key={entry.id}
                  date={entry.date}
                  tone="gain"
                  title="Férié travaillé"
                  detail={`Férié · +${minutesLabel(entry.minutes)}`}
                  status={state?.remainingMinutes ? `${minutesLabel(state.remainingMinutes)} disponibles` : "Gain utilisé"}
                  statusTone={state?.remainingMinutes ? "left" : undefined}
                  value={`+ ${minutesLabel(entry.minutes)}`}
                  deleteText="Supprimer"
                  deleteLabel={fullDate(entry.date)}
                />
              );
            }
            if (entry.id.startsWith("solidarity-")) {
              return (
                <HistoryRow
                  key={entry.id}
                  date={entry.date}
                  tone="gain"
                  title="Ajout manuel"
                  detail="Solde repris, majoration comprise"
                  status={state?.remainingMinutes ? `${minutesLabel(state.remainingMinutes)} disponibles` : "Ajout manuel entièrement utilisé"}
                  statusTone={state?.remainingMinutes ? "left" : undefined}
                  value={`+ ${minutesLabel(entry.minutes)}`}
                  deleteText="Supprimer"
                  deleteLabel={fullDate(entry.date)}
                  onDelete={() => onDeleteOvertime(entry)}
                />
              );
            }
            const range = rangeLabel(entry.start, entry.end);
            if (entry.disposition === "paid") {
              const pay = overtimePayPeriod(entry);
              return (
                <HistoryRow
                  key={entry.id}
                  date={entry.date}
                  tone="paid"
                  title="Heures sup"
                  badge={{ label: isPaidAlready(pay) ? "Payées" : "À payer", tone: "paid" }}
                  detail={range || "Durée saisie sans horaires"}
                  status={entry.paidEarly ? `Déjà payées en ${MONTHS[pay.month]} ${pay.year}` : `Paie de ${MONTHS[pay.month]} ${pay.year}`}
                  value={minutesLabel(entry.minutes)}
                  deleteText="Supprimer"
                  deleteLabel={fullDate(entry.date)}
                  onDelete={() => onDeleteOvertime(entry)}
                />
              );
            }
            /* Le gain se lit mieux que le total : « 3 h → 3 h 45 » laissait
               chercher l'écart, « 45 min gagnées » le donne. */
            const creditedMinutes = state?.earnedMinutes ?? entry.minutes;
            const gainedMinutes = creditedMinutes - entry.minutes;
            return (
              <HistoryRow
                key={entry.id}
                date={entry.date}
                tone="gain"
                title="Heures sup"
                badge={{ label: "Récupération", tone: "recovery" }}
                detail={[range, gainedMinutes > 0
                  ? `${minutesLabel(entry.minutes)} travaillées → ${minutesLabel(gainedMinutes)} gagnées (${minutesLabel(creditedMinutes)})`
                  : `${minutesLabel(entry.minutes)} travaillées → ${minutesLabel(creditedMinutes)} de récup`].filter(Boolean).join(" · ")}
                status={state?.remainingMinutes ? `${minutesLabel(state.remainingMinutes)} disponibles` : "Gain entièrement utilisé"}
                statusTone={state?.remainingMinutes ? "left" : undefined}
                value={`+ ${minutesLabel(creditedMinutes)}`}
                deleteText="Supprimer"
                deleteLabel={fullDate(entry.date)}
                onDelete={() => onDeleteOvertime(entry)}
              />
            );
          })}
        </section>
      ))}
    </>
  );
}

/** « 2026-10-08 » pour la date du jour. */
function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}


/** Dans l'ordre des dates : les mécénats passés restent au-dessus, en
 *  rouge, puis ceux à venir, du plus proche au plus éloigné. */
const inDateOrder = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

/** « paie de novembre », « paie d’octobre ». */
function payOf(month: string) {
  return /^[aeiouâéèêîôû]/i.test(month) ? `paie d’${month}` : `paie de ${month}`;
}

/** Mécénats : un bloc par mois, une ligne par soirée, séparées d'un trait.
 *  Le mois de paie, commun d'ordinaire, se lit une fois dans l'en-tête. */
export function MecenatHistoryList({ entries, onDelete, today = new Date() }: { entries: MecenatEntry[]; onDelete: (entry: MecenatEntry) => void; today?: Date }) {
  return (
    <>
      {groupByMonth(entries, inDateOrder).map((group) => {
        const payMonths = new Set(group.items.map((entry) => `${entry.payYear}-${entry.payMonth}`));
        const sharedPay = payMonths.size === 1 ? group.items[0] : null;
        const total = euros(group.items.reduce((sum, entry) => sum + entry.grossAmountCents, 0) / 100);
        return (
          <section key={group.key} className="history-month" aria-label={group.label}>
            <h4>
              {group.label}
              <small>{sharedPay ? `${total} brut · ${payOf(MONTHS[sharedPay.payMonth])}` : `${total} brut`}</small>
            </h4>
            <ul className="mecenat-history-list">
              {group.items.map((entry) => {
                const day = fromKey(entry.date);
                const weekday = day.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
                const past = entry.date < dayKeyOf(today);
                return (
                  <li key={entry.id} className={`mecenat-history-row${past ? " is-past" : ""}`}>
                    <time className="mecenat-history-date" dateTime={entry.date}>
                      <small>{weekday}</small>
                      <b>{day.getDate()}</b>
                    </time>
                    <span className="mecenat-history-main">
                      <strong>
                        {rangeLabel(entry.start, entry.end)}
                        {past ? <em className="mecenat-done">✓ Fait</em> : null}
                      </strong>
                      <small>
                        {minutesLabel(entry.dayMinutes + entry.nightMinutes)}
                        {entry.nightMinutes ? ` · dont ${minutesLabel(entry.nightMinutes)} de nuit` : ""}
                        {sharedPay ? "" : ` · ${payOf(MONTHS[entry.payMonth])} ${entry.payYear}`}
                      </small>
                    </span>
                    <span className="mecenat-history-value">{euros(entry.grossAmountCents / 100)}</span>
                    <button type="button" className="mecenat-history-delete" onClick={() => onDelete(entry)} aria-label={`Supprimer : ${fullDate(entry.date)}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v6M13.5 10.5v6" /></svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
