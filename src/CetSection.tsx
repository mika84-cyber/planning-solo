import { useMemo, useState } from "react";
import type { PayStatus } from "./appModel";
import { CetFormDialog, type CetFormKind } from "./CetFormDialog";
import {
  CET_OPERATION_LABELS,
  CET_SOURCE_LABELS,
  CET_WORK_RULES,
  cetAvailableWholeDays,
  cetBalance,
  cetDepositCapacity,
  cetDepositEligibility,
  cetDepositsForYear,
  cetDepositWindow,
  cetOptionCapacity,
  cetSourceDepositCapacity,
  cetYearEndSummary,
  emptyCetAccount,
  type CetAccount,
  type CetDepositSource,
  type CetOperationKind,
} from "./cet";

type CetSectionProps = {
  account?: CetAccount;
  status: PayStatus;
  fullName: string;
  signature: string;
  annualDaysTaken: number;
  plannedLeaveDays: number;
  remaining: { annual: number; rtt: number; fraction: number };
  saving: boolean;
  onSave: (account: CetAccount) => Promise<boolean>;
  onRequestLeave: () => void;
};

const frDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function numberLabel(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export function CetSection({
  account,
  status,
  fullName,
  signature,
  annualDaysTaken,
  plannedLeaveDays,
  remaining,
  saving,
  onSave,
  onRequestLeave,
}: CetSectionProps) {
  const [open, setOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [draft, setDraft] = useState<CetAccount>(() => account || emptyCetAccount());
  const [operationOpen, setOperationOpen] = useState(false);
  const [operationKind, setOperationKind] = useState<CetOperationKind>("deposit");
  const [operationSource, setOperationSource] = useState<CetDepositSource>("annual");
  const [operationDate, setOperationDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [operationDays, setOperationDays] = useState("1");
  const [operationNote, setOperationNote] = useState("");
  const [error, setError] = useState("");
  const [formKind, setFormKind] = useState<CetFormKind | null>(null);

  const active = account?.enabled ? account : undefined;
  const trackedAccount = active && plannedLeaveDays > 0
    ? {
        ...active,
        operations: [
          ...active.operations,
          { id: "planning-cet-leave", date: new Date().toISOString().slice(0, 10), kind: "leave" as const, days: plannedLeaveDays, note: "Congés CET du planning" },
        ],
      }
    : active;
  const summary = trackedAccount ? cetYearEndSummary(trackedAccount, status) : null;
  const activeRule = CET_WORK_RULES[(active || draft).workRule];
  const eligible = cetDepositEligibility(
    annualDaysTaken,
    activeRule.minimumAnnualDaysTaken,
  );
  const wholeDays = cetAvailableWholeDays(remaining);
  const availableTotal = wholeDays.annual + wholeDays.rtt + wholeDays.fraction;
  const depositCapacity = trackedAccount ? cetDepositCapacity(cetBalance(trackedAccount)) : 0;
  const simulationYear = new Date().getFullYear();
  const depositableBySource = trackedAccount
    ? (Object.keys(wholeDays) as CetDepositSource[]).reduce(
        (values, source) => ({
          ...values,
          [source]: cetSourceDepositCapacity(
            trackedAccount,
            source,
            wholeDays[source],
            `${simulationYear}-11-15`,
          ),
        }),
        { annual: 0, rtt: 0, fraction: 0 },
      )
    : { annual: 0, rtt: 0, fraction: 0 };
  const maximumDepositable = active
    ? Math.min(
        availableTotal,
        depositCapacity,
        depositableBySource.annual + depositableBySource.rtt + depositableBySource.fraction,
      )
    : 0;
  const currentYearDeposits = active
    ? cetDepositsForYear(active, simulationYear)
    : [];
  const history = useMemo(
    () => [...(active?.operations || [])].sort((a, b) => b.date.localeCompare(a.date)),
    [active?.operations],
  );

  function beginSettings() {
    setDraft(account ? { ...account, operations: [...account.operations] } : emptyCetAccount());
    setError("");
    setEditingSettings(true);
    setOpen(true);
  }

  async function saveSettings() {
    if (!Number.isInteger(draft.initialBalance) || draft.initialBalance < 0 || draft.initialBalance > 200) {
      setError("Indiquez un solde officiel en jours entiers, entre 0 et 200.");
      return;
    }
    const saved = await onSave({
      ...draft,
      employer: "public-establishment",
      employerName: "Centre Pompidou",
      category: "C",
      workRule: "visitor_service",
    });
    if (saved) setEditingSettings(false);
  }

  async function addOperation() {
    if (!active) return;
    const parsed = Number(operationDays.replace(",", "."));
    if (!operationDate || !Number.isInteger(parsed) || parsed === 0 || Math.abs(parsed) > 200) {
      setError("Indiquez une date et un nombre entier de jours différent de zéro.");
      return;
    }
    if (operationKind !== "adjustment" && parsed < 0) {
      setError("Utilisez un nombre positif pour cette opération.");
      return;
    }
    if (operationKind === "deposit" && !eligible.eligible) {
      setError(`L’alimentation est bloquée tant que ${activeRule.minimumAnnualDaysTaken} jours de congés annuels n’ont pas été pris dans l’année pour ce cycle.`);
      return;
    }
    if (operationKind === "deposit") {
      const window = cetDepositWindow(operationDate);
      if (!window.open) {
        setError("L’alimentation doit être enregistrée entre le 15 novembre et le 31 décembre.");
        return;
      }
      const deposits = cetDepositsForYear(active, window.year);
      if (deposits.some((operation) => operation.date !== operationDate)) {
        setError("Une alimentation est déjà enregistrée pour cette année. La demande annuelle doit être faite en une seule fois.");
        return;
      }
      if (deposits.some((operation) => operation.source === operationSource)) {
        setError("Cette origine est déjà comprise dans l’alimentation annuelle enregistrée.");
        return;
      }
      const maximum = cetSourceDepositCapacity(
        active,
        operationSource,
        wholeDays[operationSource],
        operationDate,
      );
      if (parsed > maximum) {
        setError(`Vous pouvez enregistrer au maximum ${numberLabel(maximum)} jour${maximum > 1 ? "s" : ""} depuis cette origine.`);
        return;
      }
    }
    if ((operationKind === "indemnity" || operationKind === "rafp") && parsed > cetOptionCapacity(trackedAccount || active)) {
      setError("Les 15 premiers jours doivent rester disponibles uniquement sous forme de congés.");
      return;
    }
    if (operationKind === "rafp" && status !== "fonctionnaire") {
      setError("L’option RAFP est réservée aux fonctionnaires.");
      return;
    }
    if (operationKind === "leave" && parsed > cetBalance(trackedAccount || active)) {
      setError("Le nombre de jours demandés dépasse le solde CET suivi.");
      return;
    }
    const next: CetAccount = {
      ...active,
      operations: [
        ...active.operations,
        {
          id: `cet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          date: operationDate,
          kind: operationKind,
          days: parsed,
          source: operationKind === "deposit" ? operationSource : undefined,
          note: operationNote.trim() || undefined,
        },
      ],
    };
    if (cetBalance(next) < 0) {
      setError("Cette opération rendrait le solde négatif.");
      return;
    }
    const saved = await onSave(next);
    if (saved) {
      setOperationOpen(false);
      setOperationDays("1");
      setOperationNote("");
      setError("");
    }
  }

  async function removeOperation(id: string) {
    if (!active) return;
    await onSave({
      ...active,
      operations: active.operations.filter((operation) => operation.id !== id),
    });
  }

  return (
    <section className="cet-section" aria-labelledby="cet-title">
      <button
        className="cet-heading"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="cet-symbol" aria-hidden="true">CET</span>
        <span>
          <span className="step-label">Compte épargne-temps</span>
          <strong id="cet-title">Mon CET</strong>
          <small>{active ? `${numberLabel(summary!.balance)} jour${summary!.balance > 1 ? "s" : ""} suivi${summary!.balance > 1 ? "s" : ""}` : "À configurer avec votre relevé RH"}</small>
        </span>
        <span className="cet-caret" aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="cet-content">
          {!active || editingSettings ? (
            <div className="cet-settings">
              <div className="cet-callout">
                <strong>Votre relevé RH reste la référence</strong>
                <p>Planning Solo vous aide à suivre et simuler votre CET, sans remplacer la validation de votre employeur.</p>
              </div>
              <div className="cet-form-grid">
                <label>
                  <span>Solde officiel actuel</span>
                  <span className="cet-number-field"><input type="number" min="0" max="200" step="1" value={draft.initialBalance} onChange={(event) => setDraft((current) => ({ ...current, initialBalance: Number(event.target.value) }))} /><i>jours</i></span>
                </label>
                <label>
                  <span>Date d’ouverture (facultatif)</span>
                  <input type="date" value={draft.openedOn} onChange={(event) => setDraft((current) => ({ ...current, openedOn: event.target.value }))} />
                </label>
              </div>
              <label className="cet-checkbox">
                <input type="checkbox" checked={draft.legacyCap70} onChange={(event) => setDraft((current) => ({ ...current, legacyCap70: event.target.checked }))} />
                <span>Mon relevé comprend un solde exceptionnel acquis en 2024 au-delà de 60 jours</span>
              </label>
              {error ? <p className="cet-error" role="alert">{error}</p> : null}
              <div className="cet-actions">
                {active ? <button type="button" onClick={() => setEditingSettings(false)}>Annuler</button> : null}
                {!active ? <button type="button" onClick={() => setFormKind("opening")}>Remplir la demande d’ouverture</button> : null}
                <button className="primary-action" type="button" disabled={saving} onClick={() => void saveSettings()}>{saving ? "Enregistrement…" : "Enregistrer mon CET"}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="cet-summary-grid">
                <div className="cet-balance-main"><span>Solde suivi</span><strong>{numberLabel(summary!.balance)} <i>jours</i></strong><small>à rapprocher du relevé RH</small></div>
                <div><span>Conservés en congés</span><strong>{numberLabel(summary!.protectedDays)}</strong><small>jusqu’au seuil de 15 jours</small></div>
                <div><span>Soumis à votre choix</span><strong>{numberLabel(summary!.optionDays)}</strong><small>{status === "fonctionnaire" ? "congés, indemnité ou RAFP" : "congés ou indemnité"}</small></div>
                <div><span>Indemnité brute indicative</span><strong>{summary!.estimatedIndemnity.toLocaleString("fr-FR")} € brut</strong><small>{summary!.indemnityRate} € bruts par jour · catégorie {active.category}</small></div>
              </div>
              {plannedLeaveDays > 0 ? <p className="cet-planning-use"><strong>{plannedLeaveDays} jour{plannedLeaveDays > 1 ? "s" : ""} CET</strong> posé{plannedLeaveDays > 1 ? "s" : ""} dans le planning et déjà retiré{plannedLeaveDays > 1 ? "s" : ""} du solde suivi.</p> : null}

              <div className="cet-deposit-preview">
                <div><span className="step-label">Simulation {simulationYear}</span><h4>Jours entiers encore disponibles</h4><small>{activeRule.label} · minimum {activeRule.minimumAnnualDaysTaken} CA pris</small></div>
                <div className="cet-source-pills"><span>CA versables <strong>{depositableBySource.annual}</strong></span><span>RTT versables <strong>{depositableBySource.rtt}</strong></span><span>Fractionnement <strong>{depositableBySource.fraction}</strong></span></div>
                {eligible.eligible ? (
                  <p>Vous avez pris au moins {activeRule.minimumAnnualDaysTaken} CA. Jusqu’à <strong>{maximumDepositable} jour{maximumDepositable > 1 ? "s" : ""}</strong> peuvent être conservés selon votre cycle, le plafond et la progression annuelle, sous réserve de validation RH.</p>
                ) : (
                  <p className="cet-warning">Il manque {numberLabel(eligible.missingDays)} jour{eligible.missingDays > 1 ? "s" : ""} de CA pris pour atteindre le minimum de {activeRule.minimumAnnualDaysTaken} jours correspondant à votre cycle.</p>
                )}
              </div>

              <div className="cet-toolbar">
                <button type="button" onClick={beginSettings}>Paramètres</button>
                <button type="button" onClick={() => setFormKind("funding")}>Remplir alimentation / indemnisation</button>
                <button type="button" onClick={onRequestLeave}>Poser un congé CET</button>
                <button className="primary-action" type="button" onClick={() => { setError(""); setOperationOpen((current) => !current); }}>Ajouter une opération</button>
              </div>
              <p className="cet-form-note">Les formulaires reprennent exactement les modèles fournis. Après téléchargement, envoyez-les à Clothilde Letourneur (clothilde.letourneur@centrepompidou.fr). Pour utiliser des jours CET, le bouton ci-dessus ouvre le formulaire de congé classique.</p>
              {operationOpen ? (
                <div className="cet-operation-form">
                  <label><span>Opération</span><select value={operationKind} onChange={(event) => setOperationKind(event.target.value as CetOperationKind)}>{Object.entries(CET_OPERATION_LABELS).filter(([kind]) => status === "fonctionnaire" || kind !== "rafp").map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
                  {operationKind === "deposit" ? <label><span>Origine</span><select value={operationSource} onChange={(event) => setOperationSource(event.target.value as CetDepositSource)}>{Object.entries(CET_SOURCE_LABELS).map(([source, label]) => <option key={source} value={source}>{label}</option>)}</select></label> : null}
                  <label><span>Date</span><input type="date" value={operationDate} onChange={(event) => setOperationDate(event.target.value)} /></label>
                  <label><span>Nombre de jours</span><input type="number" step="1" value={operationDays} onChange={(event) => setOperationDays(event.target.value)} /></label>
                  {operationKind === "deposit" ? <p className="cet-operation-help">Demande annuelle unique, à enregistrer du 15 novembre au 31 décembre. Si plusieurs origines sont utilisées, ajoutez-les avec la même date.</p> : null}
                  <label className="cet-operation-note"><span>Note (facultatif)</span><input value={operationNote} onChange={(event) => setOperationNote(event.target.value)} maxLength={120} /></label>
                  {error ? <p className="cet-error" role="alert">{error}</p> : null}
                  <button className="primary-action" type="button" disabled={saving} onClick={() => void addOperation()}>{saving ? "Enregistrement…" : "Enregistrer l’opération"}</button>
                </div>
              ) : null}

              <div className="cet-history">
                <h4>Historique</h4>
                {history.length ? history.map((operation) => (
                  <article key={operation.id}>
                    <span className={`cet-operation-sign ${operation.kind}`}>{operation.kind === "deposit" || (operation.kind === "adjustment" && operation.days > 0) ? "+" : "−"}</span>
                    <span><strong>{CET_OPERATION_LABELS[operation.kind]}</strong><small>{frDate.format(new Date(`${operation.date}T12:00:00`))}{operation.source ? ` · ${CET_SOURCE_LABELS[operation.source]}` : ""}{operation.note ? ` · ${operation.note}` : ""}</small></span>
                    <b>{numberLabel(Math.abs(operation.days))} j</b>
                    <button type="button" onClick={() => void removeOperation(operation.id)} disabled={saving} aria-label={`Supprimer l’opération du ${operation.date}`}>×</button>
                  </article>
                )) : <p>Aucune opération enregistrée. Ajoutez les mouvements figurant sur votre relevé RH.</p>}
              </div>
              <p className="cet-legal-note">Règles FPE, arrêté du ministère de la Culture et barème Centre Pompidou : alimentation unique en jours entiers du 15 novembre au 31 décembre, choix avant le 31 janvier. Les 15 premiers jours sont utilisables uniquement en congés. Les modalités de votre établissement et votre relevé RH prévalent.</p>
            </>
          )}
        </div>
      ) : null}
      <CetFormDialog
        kind={formKind}
        fullName={fullName}
        signature={signature}
        year={simulationYear}
        annualBalance={wholeDays.annual + wholeDays.fraction}
        rttBalance={wholeDays.rtt}
        depositDays={currentYearDeposits.reduce((total, operation) => total + operation.days, 0)}
        balanceBefore={trackedAccount ? cetBalance(trackedAccount) - currentYearDeposits.reduce((total, operation) => total + operation.days, 0) : 0}
        onClose={() => setFormKind(null)}
      />
    </section>
  );
}
