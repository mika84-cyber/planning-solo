import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { getDayInfo, MONTHS } from "./planningLogic";
import type { PersonalPresence } from "./appModel";
import { ColleagueGroupsDirectory } from "./ColleagueGroupsDirectory";
import { matchesSearch } from "./searchMatching";
import {
  getColleagueDirectory,
  getSharedColleaguePlanning,
  updateColleagueSharing,
  type ColleagueDirectory,
  type ColleagueShare,
  type SharedColleaguePlanning,
} from "./colleagueSharingApi";
import "./colleaguePlanning.css";

type Props = { demoMode: boolean; initialName: string; getOwnPresence?: (date: Date) => PersonalPresence; ownGroup?: number };

const demoDirectory: ColleagueDirectory = {
  self: { userId: "demo-mika", displayName: "Mika", visible: true },
  canShareWithoutApproval: true,
  directory: [
    { userId: "demo-agnes", displayName: "Agnès" },
    { userId: "demo-camille", displayName: "Camille" },
    { userId: "demo-samir", displayName: "Samir" },
  ],
  incoming: [{ ownerId: "demo-agnes", viewerId: "demo-mika", ownerName: "Agnès", viewerName: "Mika", status: "accepted", createdAt: "2026-09-01", updatedAt: "2026-09-01" }],
  outgoing: [{ ownerId: "demo-mika", viewerId: "demo-agnes", ownerName: "Mika", viewerName: "Agnès", status: "accepted", createdAt: "2026-09-01", updatedAt: "2026-09-01" }],
  blocked: [],
};
const demoPlanning: SharedColleaguePlanning = {
  owner: { userId: "demo-agnes", displayName: "Agnès" },
  group: 2,
  days: [
    { date: "2026-09-07", status: "absence" },
    { date: "2026-09-08", status: "absence" },
    { date: "2026-09-09", status: "absence" },
    { date: "2026-09-14", status: "partial", halfMoment: "morning" },
    { date: "2026-09-21", status: "absence" },
  ],
};

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 12);
const tomorrowDate = (reference = new Date()) => {
  const tomorrow = new Date(reference);
  tomorrow.setHours(12, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};
const tomorrowDateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const tomorrowTitleDateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" });
export const colleagueTomorrowDateLabel = (reference = new Date()) => tomorrowTitleDateFormatter.format(tomorrowDate(reference));
/** Le jour consulté dans « Qui travaille ? », compté depuis aujourd'hui. */
export const colleagueBoardDate = (offset: number, reference = new Date()) => {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};
/** « Qui travaille demain ? (vendredi 18/09) », « … aujourd’hui ? … » ou,
 *  plus loin, « Qui travaille mardi 22/09 ? ». */
export function colleagueBoardTitle(offset: number, reference = new Date()) {
  const label = tomorrowTitleDateFormatter.format(colleagueBoardDate(offset, reference));
  if (offset === 0) return `Qui travaille aujourd’hui ? (${label})`;
  if (offset === 1) return `Qui travaille demain ? (${label})`;
  return `Qui travaille ${label} ?`;
}
/** On peut regarder jusqu'à deux mois devant soi. */
const BOARD_MAX_OFFSET = 60;
const isReadableShare = (share: ColleagueShare) => share.status === "accepted";
type TomorrowStatus = "Travail" | "Formation" | "Repos" | "Absence" | "1/2 journée · matin" | "1/2 journée · après-midi" | "Absence partielle";

function tomorrowStatusTone(status: TomorrowStatus) {
  if (status === "Travail") return "work";
  if (status === "Formation") return "training";
  if (status === "Repos") return "rest";
  if (status.startsWith("1/2 journée") || status === "Absence partielle") return "partial";
  return "absence";
}

/** Statut de demain pour l'utilisateur, lu dans son propre planning. */
export function personalTomorrowStatus(presence: PersonalPresence): TomorrowStatus {
  if (presence.status === "work") return "Travail";
  if (presence.status === "training") return "Formation";
  if (presence.status === "rest") return "Repos";
  if (presence.status === "absence") return "Absence";
  return presence.halfMoment === "morning" ? "1/2 journée · matin" : presence.halfMoment === "afternoon" ? "1/2 journée · après-midi" : "Absence partielle";
}

export function sharedPlanningDayStatus(planning: SharedColleaguePlanning, date: Date): TomorrowStatus {
  const key = dateKey(date);
  const shared = planning.days.find((day) => day.date === key);
  if (shared?.status === "absence") return "Absence";
  if (shared?.status === "rest") return "Repos";
  if (shared?.status === "training") return "Formation";
  if (shared?.status === "partial") return shared.halfMoment === "morning" ? "1/2 journée · matin" : shared.halfMoment === "afternoon" ? "1/2 journée · après-midi" : "Absence partielle";
  if (shared?.status === "work") return "Travail";
  return getDayInfo(date, planning.group).kind === "off" ? "Repos" : "Travail";
}

export function sharedPlanningTomorrowSummary(planning: SharedColleaguePlanning, date: Date) {
  return { status: sharedPlanningDayStatus(planning, date), group: planning.group };
}

export type CommonPresence = "full" | "morning" | "afternoon" | "imprecise" | null;

function presentHalves(presence: PersonalPresence): Set<"morning" | "afternoon"> | null {
  if (presence.status === "work" || presence.status === "training") return new Set(["morning", "afternoon"]);
  if (presence.status === "rest" || presence.status === "absence") return new Set();
  if (presence.halfMoment === "morning") return new Set(["afternoon"]);
  if (presence.halfMoment === "afternoon") return new Set(["morning"]);
  return null;
}

export function compareCommonPresence(own: PersonalPresence, colleague: PersonalPresence): CommonPresence {
  if (own.status === "rest" || own.status === "absence" || colleague.status === "rest" || colleague.status === "absence") return null;
  const ownParts = presentHalves(own);
  const colleagueParts = presentHalves(colleague);
  if (!ownParts || !colleagueParts) return own.status === "partial" || colleague.status === "partial" ? "imprecise" : null;
  const common = [...ownParts].filter((part) => colleagueParts.has(part));
  return common.length === 2 ? "full" : common[0] ?? null;
}

function sharedPresenceForDate(planning: SharedColleaguePlanning, date: Date): PersonalPresence {
  const shared = planning.days.find((day) => day.date === dateKey(date));
  if (shared) return shared;
  return { status: getDayInfo(date, planning.group).kind === "off" ? "rest" : getDayInfo(date, planning.group).kind === "training" ? "training" : "work" };
}

export function CommonDaysPanel({ planning, view, getOwnPresence, referenceDate = new Date() }: {
  planning: SharedColleaguePlanning;
  view: Date;
  getOwnPresence: (date: Date) => PersonalPresence;
  referenceDate?: Date;
}) {
  const days = Array.from({ length: new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate() }, (_, index) => new Date(view.getFullYear(), view.getMonth(), index + 1, 12)).flatMap((date) => {
    const common = compareCommonPresence(getOwnPresence(date), sharedPresenceForDate(planning, date));
    if (!common || dateKey(date) < dateKey(referenceDate)) return [];
    const label = common === "full" ? "Toute la journée" : common === "morning" ? "Le matin" : common === "afternoon" ? "L’après-midi" : "Présence commune possible · précision manquante";
    return [{ date, label }];
  });

  return (
    <section className="colleague-common-days" aria-live="polite">
      <header><span aria-hidden="true">◎</span><div><h3>Nos présences en commun</h3></div></header>
      {days.length > 0 ? <div>{days.map(({ date, label }) => <article key={dateKey(date)}><strong>{tomorrowDateFormatter.format(date)}</strong><span>{label}</span></article>)}</div> : <p>Aucun jour de présence commune sur cette période</p>}
    </section>
  );
}

function MonthGrid({ planning, view }: { planning: SharedColleaguePlanning; view: Date }) {
  const first = startOfMonth(view);
  const mondayOffset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => new Date(view.getFullYear(), view.getMonth(), index - mondayOffset + 1, 12));
  const sharedDay = (key: string) => planning.days.find((day) => day.date === key);
  return (
    <div className="colleague-calendar" role="group" aria-label={`Planning de ${planning.owner.displayName}, ${MONTHS[view.getMonth()]} ${view.getFullYear()}`}>
      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => <strong className="colleague-weekday" key={day}>{day}</strong>)}
      {cells.map((date) => {
        const key = dateKey(date);
        const currentMonth = date.getMonth() === view.getMonth();
        if (!currentMonth) return <div key={key} className="colleague-day outside" aria-hidden="true" />;
        const today = key === dateKey(new Date());
        const info = getDayInfo(date, planning.group);
        const shared = sharedDay(key);
        const onLeave = shared?.status === "absence";
        const partial = shared?.status === "partial";
        const halfClass = partial ? ` half-${shared.halfMoment || "unknown"}` : "";
        const absenceLabel = partial
          ? shared.halfMoment === "morning"
            ? "1/2 journée · matin"
            : shared.halfMoment === "afternoon"
              ? "1/2 journée · après-midi"
              : "1/2 journée"
          : "Absent";
        return (
          <div key={key} className={`colleague-day ${info.kind}${onLeave ? " absent" : ""}${halfClass}${today ? " today" : ""}`} aria-current={today ? "date" : undefined}>
            {today ? <i className="colleague-today-dot" aria-hidden="true" /> : null}
            <span>{date.getDate()}</span>
            {onLeave || partial ? <small>{absenceLabel}</small> : <small>{shared?.status === "work" ? "Travail" : shared?.status === "training" ? "Formation" : shared?.status === "rest" ? "Repos" : info.kind === "work" ? "Travail" : info.kind === "training" ? "Formation" : "Repos"}</small>}
          </div>
        );
      })}
    </div>
  );
}

export function ColleaguePlanningPage({ demoMode, initialName, getOwnPresence, ownGroup }: Props) {
  const [data, setData] = useState<ColleagueDirectory | null>(demoMode ? demoDirectory : null);
  const [name, setName] = useState(initialName || (demoMode ? demoDirectory.self.displayName : ""));
  const [query, setQuery] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(!demoMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SharedColleaguePlanning | null>(null);
  const [view, setView] = useState(() => startOfMonth(new Date()));
  const [receivedPlannings, setReceivedPlannings] = useState<Record<string, SharedColleaguePlanning>>({});
  const [boardOffset, setBoardOffset] = useState(1);
  const [tomorrowFailed, setTomorrowFailed] = useState<string[]>([]);
  const [tomorrowAttempt, setTomorrowAttempt] = useState(0);
  const [commonDaysOpen, setCommonDaysOpen] = useState(false);
  // Première visite : l'aide et le profil sont visibles d'emblée. Ensuite, une
  // fois inscrit, ils se rangent dans « Réglages du partage ».
  const [firstVisit] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return window.localStorage.getItem("planning:colleague-guide-seen") !== "1"; } catch { return true; }
  });

  useEffect(() => {
    try { window.localStorage.setItem("planning:colleague-guide-seen", "1"); } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (demoMode) {
      setDirectoryLoading(false);
      return;
    }
    setDirectoryLoading(true);
    try {
      const next = await getColleagueDirectory();
      setData(next);
      setName((current) => current || next.self.displayName);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le partage est indisponible.");
    } finally { setDirectoryLoading(false); }
  }, [demoMode]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (demoMode) return;
    const update = () => void refresh();
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("calendar-sync", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("calendar-sync", update);
      document.removeEventListener("visibilitychange", update);
      window.clearInterval(timer);
    };
  }, [demoMode, refresh]);

  const mutate = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      if (demoMode) {
        if (payload.action === "set-profile" && data) {
          const displayName = String(payload.displayName || "").trim();
          setData({ ...data, self: { ...data.self, displayName, visible: payload.visible === true } });
        } else if (payload.action === "disable-sharing" && data) {
          setData({ ...data, self: { ...data.self, visible: false }, incoming: [], outgoing: [] });
          setSelected(null);
        } else if (payload.action === "block-person" && data) {
          const person = data.directory.find((item) => item.userId === payload.userId);
          if (person) setData({ ...data, directory: data.directory.filter((item) => item.userId !== person.userId), blocked: [...data.blocked, person] });
        } else if (payload.action === "unblock-person" && data) {
          const person = data.blocked.find((item) => item.userId === payload.userId);
          if (person) setData({ ...data, blocked: data.blocked.filter((item) => item.userId !== person.userId), directory: [...data.directory, person].sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")) });
        } else if (payload.action === "share" && data) {
          const colleague = data.directory.find((item) => item.userId === payload.viewerId);
          if (colleague) setData({ ...data, outgoing: [...data.outgoing.filter((share) => share.viewerId !== colleague.userId), {
            ownerId: data.self.userId, viewerId: colleague.userId, ownerName: data.self.displayName,
            viewerName: colleague.displayName, status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }] });
        } else if (payload.action === "remove-access" && data) {
          setData({ ...data, incoming: data.incoming.filter((share) => share.ownerId !== payload.ownerId) });
          if (selected?.owner.userId === payload.ownerId) setSelected(null);
        } else if (payload.action === "revoke" && data) {
          setData({ ...data, outgoing: data.outgoing.filter((share) => share.viewerId !== payload.viewerId) });
        }
      } else setData(await updateColleagueSharing(payload));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’action n’a pas pu être enregistrée.");
    } finally { setBusy(false); }
  };

  const confirmMutation = (message: string, payload: Record<string, unknown>) => {
    if (window.confirm(message)) void mutate(payload);
  };

  const openPlanning = async (ownerId: string) => {
    setBusy(true);
    try {
      const planning = demoMode ? demoPlanning : await getSharedColleaguePlanning(ownerId);
      setSelected(planning);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ce planning est indisponible.");
    } finally { setBusy(false); }
  };

  const downloadPlanning = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const { downloadColleaguePlanningYearPdf } = await import("./colleaguePlanningPdf");
      await downloadColleaguePlanningYearPdf(selected, view.getFullYear());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le PDF n’a pas pu être créé.");
    } finally { setBusy(false); }
  };

  const directory = useMemo(() => {
    if (!data) return [];
    const sharedIds = new Set(data.outgoing.map((share) => share.viewerId));
    return data.directory
      .filter((item) => matchesSearch(item.displayName, query))
      .sort((first, second) => {
        const sharingPriority = Number(sharedIds.has(second.userId)) - Number(sharedIds.has(first.userId));
        return sharingPriority || first.displayName.localeCompare(second.displayName, "fr");
      });
  }, [data, query]);
  const received = useMemo(() => data?.incoming.filter(isReadableShare) || [], [data?.incoming]);
  const savedName = data?.self.displayName || "";
  const nameChanged = name.trim() !== savedName;
  // L'utilisateur figure aussi dans « Qui travaille demain ? », dans son groupe.
  const boardDate = colleagueBoardDate(boardOffset);
  const tomorrowSummaries: Record<string, { status: TomorrowStatus; group: number }> = Object.fromEntries(
    Object.entries(receivedPlannings).map(([ownerId, planning]) => [ownerId, sharedPlanningTomorrowSummary(planning, boardDate)]),
  );
  const selfTomorrow = getOwnPresence && ownGroup ? { status: personalTomorrowStatus(getOwnPresence(boardDate)), group: ownGroup } : null;
  const selfName = data?.self.displayName || name.trim() || "Vous";

  // biome-ignore lint/correctness/useExhaustiveDependencies: tomorrowAttempt relance les lectures après Réessayer.
  useEffect(() => {
    setTomorrowFailed([]);
    setReceivedPlannings({});
    if (!received.length) return;
    let cancelled = false;
    for (const share of received) void (async () => {
      try {
        const planning = demoMode ? demoPlanning : await getSharedColleaguePlanning(share.ownerId);
        if (!cancelled) setReceivedPlannings((current) => ({ ...current, [share.ownerId]: planning }));
      } catch {
        if (!cancelled) setTomorrowFailed((current) => [...current, share.ownerId]);
      }
    })();
    return () => { cancelled = true; };
  }, [demoMode, received, tomorrowAttempt]);

  useEffect(() => {
    if (selected) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selected]);

  if (selected) return (
    <section className="colleague-sharing-page">
      {error ? <p className="colleague-error" role="alert">{error}</p> : null}
      <section className="colleague-card colleague-planning-view">
        <div className="colleague-planning-heading"><div><p className="eyebrow">Planning partagé</p><h2>{selected.owner.displayName}</h2></div><button className="secondary" type="button" onClick={() => setSelected(null)}>Retour à mes collègues</button></div>
        <div className="colleague-month-nav"><button className="period-step" type="button" aria-label="Mois précédent" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1, 12))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg></button><strong><span>{MONTHS[view.getMonth()]}</span><i aria-hidden="true" /><span>{view.getFullYear()}</span></strong><button className="period-step" type="button" aria-label="Mois suivant" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1, 12))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg></button></div>
        <section className={`colleague-planning-tools${commonDaysOpen ? " is-comparing" : ""}`} aria-label="Outils du planning partagé">
          <div className="colleague-planning-tools-heading"><span>Outils du mois</span><small>{MONTHS[view.getMonth()]} {view.getFullYear()}</small></div>
          <div className="colleague-planning-tool-actions">
            {getOwnPresence ? <button className={`colleague-planning-tool common${commonDaysOpen ? " active" : ""}`} type="button" aria-expanded={commonDaysOpen} onClick={() => setCommonDaysOpen((current) => !current)}><span className="colleague-planning-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6m1-6c3.3 0 6 2.2 6 5" /></svg></span><span><strong>Nos jours en commun</strong><small>Comparer nos présences</small></span></button> : null}
            <button className="colleague-planning-tool pdf colleague-pdf-download" type="button" disabled={busy} onClick={() => void downloadPlanning()}><span className="colleague-planning-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7zM14 3v5h5M12 10v7m-3-3 3 3 3-3" /></svg></span><span><strong>Télécharger en PDF</strong><small>Conserver ce planning</small></span></button>
          </div>
        </section>
        {commonDaysOpen && getOwnPresence ? <CommonDaysPanel planning={selected} view={view} getOwnPresence={getOwnPresence} /> : null}
        <MonthGrid planning={selected} view={view} />
        <p className="colleague-privacy-reminder">Les absences sont volontairement affichées sans leur motif.</p>
      </section>
    </section>
  );

  // Une fois inscrit, l'aide et le profil ne servent plus qu'à l'occasion :
  // ils rejoignent la liste de ce qu'on ouvre rarement.
  const settingsCollapsed = Boolean(data?.self.visible && !firstVisit);
  const settingsCards = (
    <>
      <section className="colleague-card colleague-how-it-works" aria-labelledby="colleague-how-title">
        {/* Les trois étapes restent toujours affichées : rien à déplier. */}
        <header className="colleague-how-header">
          <p className="eyebrow" id="colleague-how-title">Comment ça marche</p>
        </header>
        <ol id="colleague-how-content">
          <li><span>1</span><p><strong>Avant de vous inscrire</strong><small>Consultez les noms de l’annuaire et bloquez discrètement une personne si nécessaire.</small></p></li>
          <li><span>2</span><p><strong>Envoyez une invitation</strong><small>Le collègue est prévenu par e-mail et dans l’application, puis choisit d’accepter ou de refuser.</small></p></li>
          <li><span>3</span><p><strong>Gardez le contrôle</strong><small>Le destinataire peut supprimer son accès et vous pouvez arrêter la diffusion à tout moment.</small></p></li>
        </ol>
      </section>

      <section className="colleague-card colleague-profile-card">
        <header className="colleague-profile-card-heading">
          <div><p className="eyebrow">Votre nom dans l’annuaire</p><h3>Être trouvé par mes collègues</h3></div>
          <button
            type="button"
            className={`colleague-directory-visibility${data?.self.visible ? " is-visible" : " is-hidden"}`}
            disabled={busy || !data || name.trim().length < 2}
            aria-pressed={data?.self.visible === true}
            aria-label={data?.self.visible ? "Masquer mon nom dans l’annuaire" : "Afficher mon nom dans l’annuaire"}
            onClick={() => confirmMutation(
              data?.self.visible
                ? "Masquer votre nom dans l’annuaire ? Vos collègues ne pourront plus vous trouver."
                : `Rendre « ${name.trim()} » visible dans l’annuaire ?`,
              { action: "set-profile", displayName: name, visible: !data?.self.visible },
            )}
          >
            <i aria-hidden="true" />{data?.self.visible ? "Visible" : "Masqué"}
          </button>
        </header>
        <div className="colleague-profile-row">
          <label className="colleague-profile-field"><span>Nom affiché dans l’annuaire</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} /></label>
          <div className="colleague-profile-actions">
            <button className="colleague-profile-save" type="button" disabled={busy || name.trim().length < 2 || Boolean(data?.self.visible && !nameChanged)} onClick={() => confirmMutation(`Confirmer le nom « ${name.trim()} » dans l’annuaire ?`, { action: "set-profile", displayName: name, visible: true })}>
              {data?.self.visible ? "Modifier" : "Enregistrer"}
            </button>
            {data?.self.visible && !data.canShareWithoutApproval ? <button className="secondary" type="button" disabled={busy} onClick={() => confirmMutation("Confirmer le refus de tous les partages de planning ?", { action: "disable-sharing" })}>Refuser le partage</button> : null}
          </div>
        </div>
        <p className="colleague-profile-privacy"><span aria-hidden="true">✓</span><small>{data?.self.visible ? "Votre nom est visible dans l’annuaire. " : "Votre nom est actuellement masqué. "}Votre adresse e-mail n’est jamais affichée.</small></p>
      </section>
    </>
  );

  return (
    <section className="colleague-sharing-page">
      {error ? <p className="colleague-error" role="alert">{error}</p> : null}

      <header className="colleague-sharing-intro colleague-share-disclosure">
        <p className="eyebrow">Partage privé</p>
        <h2>Planning des collègues</h2>
        <p>Partagez uniquement vos jours de présence et d’absence. Vos notes, votre paie et vos informations personnelles restent privées.</p>
      </header>

      {/* Ce qui sert chaque jour vient en premier : qui travaille, jour par jour. */}
      {data?.self.visible && received.length ? <section className="colleague-card colleague-tomorrow colleague-day-board" aria-labelledby="colleague-tomorrow-title">
        <header className="colleague-tomorrow-heading">
          <div><p className="eyebrow">En un coup d’œil</p><h4 id="colleague-tomorrow-title">{colleagueBoardTitle(boardOffset)}</h4></div>
          <div className="colleague-day-steps">
            <button className="period-step" type="button" aria-label="Jour précédent" disabled={boardOffset <= 0} onClick={() => setBoardOffset((offset) => Math.max(0, offset - 1))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg></button>
            <button className="period-step" type="button" aria-label="Jour suivant" disabled={boardOffset >= BOARD_MAX_OFFSET} onClick={() => setBoardOffset((offset) => Math.min(BOARD_MAX_OFFSET, offset + 1))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg></button>
          </div>
        </header>
        {received.some((share) => !tomorrowSummaries[share.ownerId] && !tomorrowFailed.includes(share.ownerId)) ? <div className="colleague-tomorrow-pending" role="status"><span className="colleague-loading-spinner" aria-hidden="true" /> Analyse des plannings en cours…</div> : null}
        {/* Sur téléphone le tableau défile : il doit pouvoir recevoir le focus pour défiler au clavier. */}
        <div className="colleague-tomorrow-table-shell" role="region" aria-label="Disponibilités du jour choisi" tabIndex={0}>
          <table className="colleague-tomorrow-table">
            <caption className="colleague-tomorrow-caption">Disponibilités des collègues par groupe</caption>
            <thead>
              <tr>
                <th scope="col">Collègue</th>
                <th scope="col">Disponibilité</th>
              </tr>
            </thead>
            <tbody>
              {([1, 2, 3] as const).map((group) => {
                const groupShares = received.filter((share) => tomorrowSummaries[share.ownerId]?.group === group);
                const selfHere = selfTomorrow?.group === group;
                const groupCount = groupShares.length + (selfHere ? 1 : 0);
                if (!groupCount) return null;
                return <Fragment key={group}>
                  <tr className={`colleague-tomorrow-group group-${group}`}><th scope="rowgroup" colSpan={2}><span className="colleague-tomorrow-group-label"><b aria-hidden="true">{group}</b>Groupe {group}</span><small>{groupCount} collègue{groupCount > 1 ? "s" : ""}</small></th></tr>
                  {selfHere && selfTomorrow ? <tr className={`colleague-tomorrow-row is-self status-${tomorrowStatusTone(selfTomorrow.status)}`}><td><strong>{selfName}</strong></td><td><span className={`colleague-tomorrow-status ${tomorrowStatusTone(selfTomorrow.status)}`}><i aria-hidden="true" />{selfTomorrow.status}</span></td></tr> : null}
                  {groupShares.map((share) => {
                    const summary = tomorrowSummaries[share.ownerId]!;
                    return <tr className={`colleague-tomorrow-row status-${tomorrowStatusTone(summary.status)}`} key={share.ownerId}>
                      <td><strong>{share.ownerName}</strong></td>
                      <td><span className={`colleague-tomorrow-status ${tomorrowStatusTone(summary.status)}`}><i aria-hidden="true" />{summary.status}</span></td>
                    </tr>;
                  })}
                </Fragment>;
              })}
              {tomorrowFailed.length > 0 ? <tr className="colleague-tomorrow-error"><td colSpan={2}><p role="status">Planning indisponible : {received.filter((share) => tomorrowFailed.includes(share.ownerId)).map((share) => share.ownerName).join(", ")}.</p><button type="button" onClick={() => setTomorrowAttempt((value) => value + 1)}>Réessayer</button></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section> : null}

      {/* À la première visite, ou tant qu'on n'est pas inscrit, l'aide et le
          profil restent dépliés, juste sous ce qui sert chaque jour. */}
      {settingsCollapsed ? null : settingsCards}

      <section className="colleague-card colleague-received-card" aria-busy={directoryLoading}>
        <header className="colleague-received-heading">
          <div><p className="eyebrow">Accès reçus</p><h3>Plannings reçus</h3></div>
          <span title={`${received.length} planning${received.length > 1 ? "s" : ""} reçu${received.length > 1 ? "s" : ""}`}>{directoryLoading ? "…" : received.length}</span>
        </header>
        <p className="colleague-received-intro">Ouvrez le planning complet d’un collègue.</p>
        {directoryLoading ? <div className="colleague-received-loading" role="status"><span className="colleague-loading-spinner" aria-hidden="true" /><span>Actualisation de vos plannings partagés…</span></div> : data?.self.visible ? <>
          <div className="colleague-list">
            {received.map((share) => <div className="colleague-received-person" key={share.ownerId}><span className="colleague-received-avatar" aria-hidden="true">{share.ownerName.charAt(0).toLocaleUpperCase("fr")}</span><span className="colleague-received-copy"><strong>{share.ownerName}</strong><small>Planning partagé avec vous</small></span><div className="colleague-inline-actions"><button type="button" disabled={busy} onClick={() => void openPlanning(share.ownerId)}>Voir</button><button className="secondary compact" type="button" disabled={busy} onClick={() => confirmMutation(`Supprimer votre accès au planning de ${share.ownerName} ?`, { action: "remove-access", ownerId: share.ownerId })}>Supprimer l’accès</button></div></div>)}
            {!received.length ? <p>Aucun planning partagé pour le moment.</p> : null}
          </div>
        </> : <p>Inscrivez-vous dans l’annuaire pour consulter les plannings reçus.</p>}
      </section>

      {/* Ce qu'on ouvre rarement tient dans une seule liste : une ligne par
          sujet, qui se déplie sur place. */}
      <section className="colleague-card colleague-more-list" aria-label="Partage, équipe et réglages">
        <details className="colleague-card colleague-share-disclosure">
          <summary>
            <span><span className="eyebrow">Annuaire</span><strong>Partager mon planning</strong><small>{data?.directory.length || 0} collègue{(data?.directory.length || 0) > 1 ? "s" : ""} disponible{(data?.directory.length || 0) > 1 ? "s" : ""}</small></span>
          </summary>
          <div className="colleague-share-content">
            <h3>Choisir un collègue</h3>
            <p>Envoyez votre planning au collègue de votre choix. Il sera prévenu par e-mail et dans l’application.</p>
            <p className="colleague-directory-help"><strong>Annuaire : {data?.directory.length || 0} collègue{(data?.directory.length || 0) > 1 ? "s" : ""}</strong><br />Seuls les noms sont affichés.</p>
            {!data?.self.visible ? <p className="colleague-registration-note">Inscrivez-vous plus haut pour envoyer ou consulter un planning. Vous pouvez déjà bloquer un nom.</p> : null}
            <input className="colleague-search" type="search" placeholder="Rechercher un nom…" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="colleague-list">
            {directory.map((person) => {
              const existing = data?.outgoing.find((share) => share.viewerId === person.userId);
              return (
                <div className={`colleague-person-row${data?.self.visible ? " is-registered" : ""}`} key={person.userId}>
                  <span className="colleague-person-name">
                    <span aria-hidden="true">{person.displayName.charAt(0).toLocaleUpperCase("fr")}</span>
                    <strong>{person.displayName}</strong>
                  </span>
                  <div className={`colleague-directory-actions${existing ? " has-shared-planning" : ""}`}>
                    {data?.self.visible ? existing ? (
                      <>
                        <span className="colleague-shared-status">Planning partagé</span>
                        <button className="compact colleague-stop-sharing" type="button" disabled={busy} onClick={() => confirmMutation(`Arrêter la diffusion de votre planning à ${person.displayName} ?`, { action: "revoke", viewerId: person.userId })}>Arrêter la diffusion</button>
                      </>
                    ) : (
                      <button className="colleague-invite" type="button" disabled={busy} onClick={() => confirmMutation(`Envoyer votre planning à ${person.displayName} ?`, { action: "share", viewerId: person.userId })}>Envoyer</button>
                    ) : null}
                    <button className="compact colleague-block" type="button" disabled={busy} onClick={() => confirmMutation(`Bloquer ${person.displayName} ? Cette personne ne pourra plus vous trouver ni partager son planning avec vous.`, { action: "block-person", userId: person.userId })}>Bloquer</button>
                  </div>
                </div>
              );
            })}
            {data && !directory.length ? <p>Aucun collègue ne correspond à cette recherche.</p> : null}
            </div>
          </div>
        </details>
        {!demoMode ? <ColleagueGroupsDirectory groups={data?.groups} /> : null}
        {settingsCollapsed ? (
          <details className="colleague-card colleague-settings-disclosure">
            <summary>
              <span><strong>Réglages du partage</strong><small>Visible dans l’annuaire sous « {data?.self.displayName} »</small></span>
            </summary>
            <div className="colleague-settings-content">{settingsCards}</div>
          </details>
        ) : null}
      </section>

      {data?.blocked.length ? <section className="colleague-card"><p className="eyebrow">Noms bloqués</p><h3>Gérer mes blocages</h3><p>Ces personnes ne peuvent pas vous trouver ni vous envoyer leur planning.</p><div className="colleague-list">{data.blocked.map((person) => <div key={person.userId}><strong>{person.displayName}</strong><button className="secondary" type="button" disabled={busy} onClick={() => confirmMutation(`Débloquer ${person.displayName} ?`, { action: "unblock-person", userId: person.userId })}>Débloquer</button></div>)}</div></section> : null}

    </section>
  );
}
