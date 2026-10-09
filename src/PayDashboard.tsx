import { useEffect, useState, type ReactNode } from "react";
import { euros } from "./appModel";
import type { PayCalculationBreakdown, PayCalculationRow } from "./PayEstimateDetails";
import { MONTHS, s } from "./planningLogic";
import { loadPayslipVerification, PAYSLIP_VERIFICATION_EVENT } from "./payslipVerificationDecision";
import "./payBulletin.css";

export type PayDashboardVariable = {
  key: string;
  label: string;
  quantity: string;
  amount: number | null;
};

/** Résultat de la comparaison avec le bulletin du mois affiché. */
export type PayDashboardVerification = {
  tone: "ok" | "partial" | "warning" | "unknown";
  label: string;
};

type PayDashboardProps = {
  month: number;
  year: number;
  gross: number;
  grossComplete: boolean;
  net: number | null;
  profileLabel: string;
  missingFields?: string[];
  onCompleteEstimate?: () => void;
  reliability: {
    tone: "exact" | "estimated" | "incomplete";
    label: string;
    detail: string;
  };
  variables: PayDashboardVariable[];
  /** Les lignes du calcul (composition du brut, retenues, passage au net),
   *  les mêmes que dans « Détail du calcul ». */
  calculation?: PayCalculationBreakdown;
  /** Fériés de l'année encore sans compensation choisie. */
  allowancesPending?: number;
  /** Comparaison avec le bulletin du mois, quand un bulletin a été ajouté. */
  verification?: PayDashboardVerification;
  /** Compte sous lequel « Tout est OK » ou une anomalie est enregistré. */
  verificationAccount?: string;
  /** Demande venue d'ailleurs (l'accueil) d'ouvrir la vérification. */
  verificationRequested?: boolean;
  onVerificationShown?: () => void;
  /** Détail des retenues maladie et grève, sous les lignes. */
  deductionContent?: ReactNode;
  profileContent: ReactNode;
  verificationContent: ReactNode;
  settingsContent: ReactNode;
  settingsOpen: boolean;
  /** Le profil est déplié (ou doit être montré) : la zone du bas s'ouvre. */
  profileOpen?: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onOpenEstimateDetails: () => void;
  onOpenAllowances: () => void;
  onToggleSettings: () => void;
  /** « Profil · réglages » s'ouvre : le profil de paie se déplie avec. */
  onOpenTools?: () => void;
  /** Et se referme avec lui, réglages compris. */
  onCloseTools?: () => void;
};

const number = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « paie d’octobre », « paie de novembre ». */
function payOf(month: string) {
  return /^[aeiouéè]/i.test(month) ? `paie d’${month}` : `paie de ${month}`;
}

const sum = (rows: PayCalculationRow[], keys: string[]) =>
  rows.filter((row) => keys.includes(row.key)).reduce((total, row) => total + (row.amount ?? 0), 0);

const INDEMNITY_NAMES: Record<string, string> = {
  residence: "résidence",
  ifse: "IFSE",
  "other-fixed": "autres",
};
const PRIME_KEYS = ["sundays", "holidays", "compensated", "cia", "overtime", "mecenat"];
const DEDUCTION_KEYS = ["sick", "strike"];

/** Un montant encore inconnu : à vérifier (valeur manquante) ou à décider
 *  (férié dont la compensation n'est pas choisie). */
function pendingOf(item: PayDashboardVariable) {
  if (item.amount === null) return "à vérifier";
  if ((item.key === "holidays" || item.key === "compensated") && !item.amount) return "à décider";
  return "";
}

type Sign = "" | "plus" | "minus";
type BulletinLine = {
  key: string;
  label: string;
  detail?: string;
  amount: number | null;
  sign: Sign;
  pending?: string;
  /** Montant habituel qui ne s'applique pas ce mois-ci : affiché barré. */
  waived?: boolean;
  onOpen?: () => void;
};
type BulletinGroup = {
  key: "fixed" | "variable" | "withheld";
  title: string;
  total: number;
  sign: Sign;
  lines: BulletinLine[];
};

const signed = (amount: number, sign: Sign) =>
  `${sign === "minus" ? "− " : sign === "plus" ? "+ " : ""}${number.format(Math.abs(amount))}`;

/**
 * Ma paie en bulletin simplifié : le mois, le net en grand avec l'état de
 * l'estimation, puis les lignes de la paie rangées comme sur un bulletin
 * (fixe, primes du mois, retenues). Vérifier le bulletin, le profil et les
 * réglages s'ouvrent depuis deux boutons. Les calculs ne changent pas : les
 * montants sont ceux de « Détail du calcul ».
 */
export function PayDashboard({
  month,
  year,
  gross,
  grossComplete,
  net,
  profileLabel,
  missingFields = [],
  onCompleteEstimate,
  reliability,
  variables,
  calculation,
  allowancesPending = 0,
  verification,
  verificationAccount,
  verificationRequested = false,
  onVerificationShown,
  deductionContent,
  profileContent,
  verificationContent,
  settingsContent,
  settingsOpen,
  profileOpen = false,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onOpenEstimateDetails,
  onOpenAllowances,
  onToggleSettings,
  onOpenTools,
  onCloseTools,
}: PayDashboardProps) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyFocus, setVerifyFocus] = useState<{ pickFile: boolean } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const showTools = toolsOpen || profileOpen || settingsOpen;
  const monthLabel = MONTHS[month].charAt(0).toUpperCase() + MONTHS[month].slice(1);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  /* « Vérifier le bulletin » propose aussitôt le PDF ou les photos : la
     vérification ne s'affiche qu'une fois un fichier choisi. Sans champ de
     fichier (bulletin déjà conclu), elle s'ouvre pour montrer le résultat. */
  const openVerification = (pickFile = false) => {
    const input = pickFile
      ? document.querySelector<HTMLInputElement>('#pay-dashboard-verification input[type="file"]')
      : null;
    if (input) {
      input.click();
      return;
    }
    setVerifyOpen(true);
    setVerifyFocus({ pickFile: false });
  };
  // Le panneau est rendu (masqué) dès l'arrivée : une fois ouvert, on peut
  // y descendre et proposer le fichier sans attendre son chargement.
  useEffect(() => {
    if (!verifyFocus) return;
    const section = document.getElementById("pay-dashboard-verification");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (verifyFocus.pickFile) section?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
    setVerifyFocus(null);
  }, [verifyFocus]);
  // Un bulletin lu pour ce mois : son résultat s'affiche sans avoir à
  // rouvrir la vérification.
  const hasVerification = Boolean(verification);
  useEffect(() => {
    if (hasVerification) setVerifyOpen(true);
  }, [hasVerification]);
  // « Tout est OK » ou « Signaler une anomalie », gardé sur cet appareil :
  // relu à chaque décision prise dans la vérification.
  const readSaved = () =>
    verificationAccount === undefined ? null : loadPayslipVerification(verificationAccount, year, month)?.status ?? null;
  const [savedStatus, setSavedStatus] = useState(readSaved);
  useEffect(() => {
    if (verificationAccount === undefined) return;
    const refresh = () => setSavedStatus(loadPayslipVerification(verificationAccount, year, month)?.status ?? null);
    refresh();
    window.addEventListener(PAYSLIP_VERIFICATION_EVENT, refresh);
    return () => window.removeEventListener(PAYSLIP_VERIFICATION_EVENT, refresh);
  }, [verificationAccount, year, month]);
  // « Ajouter un bulletin de paie » depuis l'accueil.
  useEffect(() => {
    if (!verificationRequested) return;
    setVerifyOpen(true);
    setVerifyFocus({ pickFile: false });
    onVerificationShown?.();
  }, [verificationRequested, onVerificationShown]);

  const composition = calculation?.grossComposition ?? [];
  const toNet = calculation && calculation.estimatedContributions !== null && calculation.incomeTax !== null
    ? calculation.estimatedContributions + calculation.mealVoucherDeduction + calculation.incomeTax - calculation.navigo
    : null;

  /* La frise : où va le brut. Le net (Navigo mis à part, il s'ajoute après
     coup), les cotisations, les titres repas et l'impôt font le brut. */
  const split = calculation && net !== null && grossComplete && calculation.estimatedContributions !== null && calculation.incomeTax !== null
    ? [
        { key: "net", label: "Net", amount: net, width: net - calculation.navigo },
        { key: "contributions", label: "Cotisations", amount: calculation.estimatedContributions, width: calculation.estimatedContributions },
        ...(calculation.mealVoucherDeduction
          ? [{ key: "meal", label: "Titres repas", amount: calculation.mealVoucherDeduction, width: calculation.mealVoucherDeduction }]
          : []),
        { key: "tax", label: "Impôt", amount: calculation.incomeTax, width: calculation.incomeTax },
      ].filter((part) => part.width > 0)
    : null;
  const splitTotal = split ? split.reduce((total, part) => total + part.width, 0) : 0;

  /* Le fixe : le traitement, puis les indemnités réunies sur une ligne dont
     le détail donne chaque montant. */
  const baseRow = composition.find((row) => row.key === "base");
  const indemnityRows = composition.filter((row) => row.key in INDEMNITY_NAMES && (row.amount ?? 0) !== 0);
  const fixedLines: BulletinLine[] = [
    ...(baseRow ? [{ key: "base", label: baseRow.label, amount: baseRow.amount, sign: "" as const, pending: baseRow.amount === null ? "à compléter" : "" }] : []),
    ...(indemnityRows.length ? [{
      key: "indemnities",
      label: "Indemnités",
      detail: indemnityRows.map((row) => `${INDEMNITY_NAMES[row.key]} ${number.format(row.amount ?? 0)}`).join(" · "),
      amount: sum(indemnityRows, indemnityRows.map((row) => row.key)),
      sign: "" as const,
    }] : []),
  ];

  /* Les primes du mois, chacune avec son détail (heures, report, choix du
     férié) ; un montant encore inconnu le dit au lieu de compter zéro. */
  const flatRow = composition.find((row) => row.key === "sunday-flat" && (row.amount ?? 0) !== 0);
  const primeLines: BulletinLine[] = [
    ...(flatRow ? [{ key: "sunday-flat", label: "Forfait dimanches", detail: "le même chaque mois", amount: flatRow.amount, sign: "plus" as const }] : []),
    ...variables
      .filter((item) => PRIME_KEYS.includes(item.key))
      .map((item) => ({
        key: item.key,
        label: item.label,
        detail: item.quantity,
        amount: item.amount,
        sign: "plus" as const,
        pending: pendingOf(item),
        onOpen: onOpenAllowances,
      })),
  ];

  /* Les retenues : maladie et grève, puis cotisations et impôt ; en
     décembre, les titres repas non prélevés apparaissent barrés. */
  const mealVoucher = variables.find((item) => item.key === "mealVoucher");
  const toNetDetail = calculation ? [
    calculation.estimatedContributions !== null ? `cotisations ${number.format(calculation.estimatedContributions)}` : "",
    calculation.incomeTax !== null ? `impôt ${number.format(calculation.incomeTax)}` : "",
    calculation.mealVoucherDeduction ? `titres repas ${number.format(calculation.mealVoucherDeduction)}` : "",
    calculation.navigo ? `Navigo remboursé ${number.format(calculation.navigo)}` : "",
  ].filter(Boolean).join(" · ") : "";
  const withheldLines: BulletinLine[] = [
    ...variables
      .filter((item) => DEDUCTION_KEYS.includes(item.key))
      .map((item) => ({
        key: item.key,
        label: item.label,
        detail: item.quantity,
        amount: item.amount === null ? null : Math.abs(item.amount),
        sign: "minus" as const,
        pending: pendingOf(item),
        onOpen: onOpenEstimateDetails,
      })),
    ...(calculation ? [{
      key: "to-net",
      label: "Cotisations · impôt",
      detail: toNetDetail,
      amount: toNet,
      sign: "minus" as const,
      pending: toNet === null ? "à compléter" : "",
      onOpen: onOpenEstimateDetails,
    }] : []),
    ...(mealVoucher ? [{
      key: "meal-voucher",
      label: "Titres repas",
      detail: mealVoucher.quantity,
      amount: mealVoucher.amount,
      sign: "minus" as const,
      waived: true,
    }] : []),
  ];

  const lineTotal = (lines: BulletinLine[]) =>
    lines.filter((line) => !line.waived).reduce((total, line) => total + Math.abs(line.amount ?? 0), 0);
  const groups: BulletinGroup[] = [
    ...(fixedLines.length ? [{ key: "fixed" as const, title: "Fixe", total: lineTotal(fixedLines), sign: "" as const, lines: fixedLines }] : []),
    { key: "variable", title: "Primes du mois", total: lineTotal(primeLines), sign: "plus", lines: primeLines },
    ...(withheldLines.length ? [{ key: "withheld" as const, title: "Retenues", total: lineTotal(withheldLines), sign: "minus" as const, lines: withheldLines }] : []),
  ];
  const pendingCount = [...primeLines, ...withheldLines].filter((line) => line.pending).length;

  const lineAmount = (line: BulletinLine) =>
    line.pending || (line.amount === null ? "à compléter" : signed(line.amount, line.sign));
  const lineAria = (line: BulletinLine) =>
    `${line.label} : ${lineAmount(line)}${line.onOpen ? ". Voir le détail" : ""}`;

  /* L'état de l'estimation, sous le net : comparée au bulletin quand il a
     été ajouté (un appui ouvre la vérification), sinon estimation. */
  const status = verification
    ? verification.tone === "ok"
      ? { tone: "ok", text: "Vérifiée avec le bulletin" }
      : verification.tone === "partial"
        ? { tone: "partial", text: "Vérification partielle · aucun écart" }
        : verification.tone === "warning"
          ? { tone: "alert", text: `Bulletin : ${verification.label}` }
          : { tone: "neutral", text: "Bulletin non comparable" }
    : savedStatus === "ok"
      ? { tone: "ok", text: "Bulletin vérifié · tout est OK" }
      : savedStatus === "attention"
        ? { tone: "alert", text: "Anomalie signalée sur le bulletin" }
    : reliability.tone === "incomplete"
      ? { tone: "alert", text: "Données à compléter" }
      : { tone: "neutral", text: "Estimation" };

  return (
    <div className="pay-dashboard pay-bulletin">
      {/* Le mois en titre, une flèche de chaque côté ; « Revenir à
          aujourd’hui » ne paraît que lorsqu’on s’éloigne du mois en cours. */}
      <div className="pay-bulletin-month" role="group" aria-label="Choisir le mois de paie">
        <button type="button" className="pay-bulletin-month-arrow" onClick={onPreviousMonth} aria-label="Mois précédent">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
        </button>
        <div className="pay-bulletin-month-title">
          <span className="pay-bulletin-kicker">Paie de</span>
          <h2 id="pay-dashboard-title">{monthLabel} {year}</h2>
          {isCurrentMonth ? null : <button type="button" className="pay-bulletin-today" onClick={onToday}>Revenir à aujourd’hui</button>}
        </div>
        <button type="button" className="pay-bulletin-month-arrow" onClick={onNextMonth} aria-label="Mois suivant">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
        </button>
      </div>

      <div className="pay-bulletin-layout">
        <section className="pay-bulletin-hero" aria-labelledby="pay-bulletin-net-title">
          <span id="pay-bulletin-net-title" className="pay-bulletin-kicker">Net estimé · {payOf(MONTHS[month])}</span>
          <p className={`pay-bulletin-net${net === null ? " is-missing" : ""}`}>{net === null ? "À compléter" : euros(net)}</p>
          <p className="pay-bulletin-gross">Brut {grossComplete ? euros(gross) : "à compléter"}</p>
          <div className="pay-bulletin-status">
            {verification || savedStatus ? (
              <button type="button" className={`pay-bulletin-chip ${status.tone}`} onClick={() => openVerification()} aria-label={`${status.text}. Voir la vérification`}>
                {status.text}<i aria-hidden="true">›</i>
              </button>
            ) : <span className={`pay-bulletin-chip ${status.tone}`}>{status.text}</span>}
            {pendingCount ? <span className="pay-bulletin-chip pending">{pendingCount} montant{s(pendingCount)} en attente</span> : null}
          </div>
          {split && splitTotal > 0 ? (
            <div className="pay-bulletin-mix">
              <p className="pay-bulletin-mix-title">Où va votre brut</p>
              <div
                className="pay-bulletin-bar"
                role="img"
                aria-label={`Sur ${euros(gross)} de brut : ${split.map((part) => `${part.label.toLowerCase()} ${euros(part.amount)}`).join(", ")}`}
              >
                {split.map((part) => (
                  <span key={part.key} className={part.key} style={{ width: `${(part.width / splitTotal) * 100}%` }} />
                ))}
              </div>
              <ul className="pay-bulletin-legend" aria-hidden="true">
                {split.map((part) => (
                  <li key={part.key} className={part.key}><span>{part.label}</span> <b>{number.format(part.amount)}</b></li>
                ))}
              </ul>
            </div>
          ) : null}
          {(net === null || !grossComplete) && missingFields.length > 0 ? <div className="pay-missing-guidance">
            <div className="pay-import-heading">
              <span className="pay-import-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5" /></svg></span>
              <div><strong>Votre estimation commence ici</strong><p>Ajoutez votre bulletin de paie. Les informations reconnues sont complétées automatiquement.</p></div>
            </div>
            <button type="button" className="primary-action" onClick={() => openVerification(true)}>Ajouter mon bulletin</button>
            <div className="pay-import-secondary">
              <button type="button" className="text-button" onClick={onCompleteEstimate}>Compléter manuellement si besoin</button>
            </div>
          </div> : null}
        </section>

        <section className="pay-bulletin-lines" aria-labelledby="pay-bulletin-lines-title">
          <h3 id="pay-bulletin-lines-title" className="pay-bulletin-kicker">Les lignes de la paie</h3>
          {groups.map((group) => (
            <div key={group.key} className={`pay-bulletin-group ${group.key}`}>
              <p className="pay-bulletin-group-head">
                <span>{group.title}</span>
                {group.lines.length && !(group.total === 0 && group.lines.some((line) => line.pending)) ? <b>{signed(group.total, group.sign)}</b> : null}
              </p>
              {group.lines.length ? (
                <ul className="pay-bulletin-list">
                  {group.lines.map((line) => {
                    const amount = lineAmount(line);
                    const content = (
                      <>
                        <span className="pay-bulletin-line-text">
                          <span>{line.label}</span>
                          {line.detail ? <small>{line.detail}</small> : null}
                        </span>
                        <b className={line.pending ? "pending" : line.waived ? "waived" : line.sign}>
                          {line.waived ? <s>{amount}</s> : amount}
                        </b>
                        <i aria-hidden="true">{line.onOpen ? "›" : ""}</i>
                      </>
                    );
                    return (
                      <li key={line.key}>
                        {line.onOpen
                          ? <button type="button" className="pay-bulletin-line" onClick={line.onOpen} aria-label={lineAria(line)}>{content}</button>
                          : <div className="pay-bulletin-line">{content}</div>}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="pay-bulletin-empty">Aucune prime sur cette paie.</p>}
            </div>
          ))}
          <p className="pay-bulletin-total">
            <span>Net estimé</span>
            <b>{net === null ? "à compléter" : number.format(net)}</b>
          </p>
          {pendingCount ? (
            <p className="pay-bulletin-total-note">
              Hors {pendingCount} montant{s(pendingCount)} en attente : le net peut encore changer.
            </p>
          ) : null}
          {deductionContent}
          {/* Le détail du calcul et celui des primes de l'année, côte à côte
              sous les lignes qu'ils expliquent. */}
          <div className="pay-bulletin-links">
            <button type="button" className="pay-bulletin-shortcut" onClick={onOpenEstimateDetails}>
              <span>
                <strong>Détail du calcul</strong>
                <small>Brut, cotisations, impôt</small>
              </span>
              <i aria-hidden="true">›</i>
            </button>
            <button type="button" className="pay-bulletin-shortcut" onClick={onOpenAllowances}>
              <span>
                <strong>Primes et jours fériés</strong>
                <small>Dimanches, fériés, heures sup</small>
                {allowancesPending ? <em>{allowancesPending} férié{s(allowancesPending)} à décider</em> : null}
              </span>
              <i aria-hidden="true">›</i>
            </button>
          </div>
          <p className="pay-bulletin-note">{profileLabel}</p>
        </section>
      </div>

      <div className="pay-bulletin-actions">
        <button type="button" className={`pay-bulletin-action primary${verifyOpen ? " open" : ""}`} aria-expanded={verifyOpen} aria-controls="pay-dashboard-verification" onClick={() => (verifyOpen ? setVerifyOpen(false) : openVerification(true))}>
          Vérifier le bulletin
        </button>
        <button type="button" className={`pay-bulletin-action${showTools ? " open" : ""}`} aria-expanded={showTools} onClick={() => {
          if (showTools) {
            setToolsOpen(false);
            onCloseTools?.();
          } else {
            setToolsOpen(true);
            onOpenTools?.();
          }
        }}>
          Profil · réglages
        </button>
      </div>

      <section
        id="pay-dashboard-verification"
        className="pay-bulletin-panel"
        aria-labelledby="pay-dashboard-verification-title"
        hidden={!verifyOpen}
        onChange={() => {
          // Un fichier vient d'être choisi : la lecture et son résultat s'affichent.
          if (verifyOpen) return;
          setVerifyOpen(true);
          setVerifyFocus({ pickFile: false });
        }}
      >
        <h3 id="pay-dashboard-verification-title">Vérifier mon bulletin</h3>
        <p>Choisissez le PDF ou la photo pour comparer ce qui était attendu avec ce qui a été versé.</p>
        {verificationContent}
      </section>

      {showTools ? (
        <div className="pay-bulletin-footer">
          <div className="pay-dashboard-profile-slot">{profileContent}</div>
          <section id="pay-dashboard-settings" className={`pay-dashboard-settings${settingsOpen ? " open" : ""}`}>
            <button
              type="button"
              className="pay-dashboard-settings-toggle"
              onClick={onToggleSettings}
              aria-expanded={settingsOpen}
              aria-controls="pay-dashboard-settings-content"
            >
              <span><span className="step-label">Moins souvent modifié</span><strong>Réglages et explications</strong></span>
              <span>{settingsOpen ? "Replier" : "Ouvrir"}</span>
              <i aria-hidden="true">⌄</i>
            </button>
            {settingsOpen ? <div id="pay-dashboard-settings-content" className="pay-dashboard-settings-content">{settingsContent}</div> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
