import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDayInfo, MONTHS } from "./planningLogic";
import type { PersonalPresence } from "./appModel";
import { ColleagueGroupsDialog, ColleagueGroupsDirectory } from "./ColleagueGroupsDirectory";
import type { ColleagueGroup } from "./colleagueGroups";
import { matchesSearch } from "./searchMatching";
import {
  getColleagueDirectory,
  getSharedColleaguePlanning,
  updateColleagueSharing,
  type ColleagueDirectory,
  type ColleagueShare,
  type SharedColleaguePlanning,
} from "./colleagueSharingApi";
import { readColleagueBoardCache, writeColleagueBoardCache } from "./colleagueBoardCache";
import "./colleaguePlanning.css";

type Props = { demoMode: boolean; initialName: string; accountId?: string; getOwnPresence?: (date: Date) => PersonalPresence; ownGroup?: number; isAdmin?: boolean };

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

/** Les groupes de la démo : des prénoms fictifs, pour ouvrir la fenêtre des
 *  groupes sans lire les vrais noms sur le serveur. */
const demoGroups: readonly ColleagueGroup[] = [
  { number: 1, members: ["Camille", "Hugo Exemple", "Léa Exemple"] },
  { number: 2, members: ["Agnès", "Mika", "Nina Exemple"] },
  { number: 3, members: ["Samir", "Jules Exemple", "Zoé Exemple"] },
];
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

/** Une fenêtre de la page des collègues. Elle reste dans la page, pour garder
 *  les styles de ses cartes, et se superpose à l'écran entier. */
function ColleagueDialog({ id, eyebrow, title, className, onClose, children }: {
  id: string;
  eyebrow: string;
  title: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-card colleague-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
        <span className="step-label">{eyebrow}</span>
        <h2 id={id}>{title}</h2>
        {children}
      </section>
    </div>
  );
}

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 12);
const tomorrowDateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const tomorrowTitleDateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" });
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
const BOARD_MAX_WEEK_OFFSET = 8;

/** Lundi de la semaine consultée : la semaine en cours, puis les suivantes. */
export function colleagueWeekStart(weekOffset: number, reference = new Date()) {
  const monday = new Date(reference);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
  return monday;
}

export function colleagueWeekDays(weekOffset: number, reference = new Date()) {
  const monday = colleagueWeekStart(weekOffset, reference);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

const weekDayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
/** « Semaine du 14 au 20 septembre », ou « du 28 septembre au 4 octobre ». */
export function colleagueWeekTitle(weekOffset: number, reference = new Date()) {
  const days = colleagueWeekDays(weekOffset, reference);
  const first = days[0];
  const last = days[6];
  const start = first.getMonth() === last.getMonth() ? String(first.getDate()) : weekDayFormatter.format(first);
  return `Semaine du ${start === "1" ? "1er" : start} au ${weekDayFormatter.format(last)}`;
}

/** Une lettre par statut, pour tenir sept jours sur un téléphone. */
const WEEK_STATUS_LETTERS: Record<TomorrowStatus, string> = {
  Travail: "T",
  Formation: "F",
  Repos: "R",
  Absence: "A",
  "1/2 journée · matin": "½",
  "1/2 journée · après-midi": "½",
  "Absence partielle": "½",
};
const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];
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
  // Sans journée partagée, le cycle du groupe fait foi, formations comprises.
  const scheduled = getDayInfo(date, planning.group).kind;
  return scheduled === "off" ? "Repos" : scheduled === "training" ? "Formation" : "Travail";
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

/** Aujourd'hui ressort, le week-end se devine : deux repères de colonne. */
function weekCellClass(day: Date, index: number, todayKey: string) {
  return [dateKey(day) === todayKey ? "is-today" : "", index >= 5 ? "is-weekend" : ""].filter(Boolean).join(" ") || undefined;
}

type WeekRow = { id: string; name: string; group: number; isSelf: boolean; statusFor: (date: Date) => TomorrowStatus; onOpen?: () => void };

/** La semaine en un tableau : une ligne par personne, rangée par groupe, et
 *  une case par jour avec la lettre de son statut. La colonne d'aujourd'hui
 *  est soulignée ; la légende rappelle les lettres. */
export function ColleagueWeekTable({ days, rows, referenceDate = new Date() }: { days: Date[]; rows: WeekRow[]; referenceDate?: Date }) {
  const todayKey = dateKey(referenceDate);
  return (
    <div className="colleague-week">
      <div className="colleague-week-shell" role="region" aria-label="Disponibilités de la semaine" tabIndex={0}>
        <table className="colleague-week-table">
          <caption className="colleague-tomorrow-caption">Disponibilités de la semaine, par groupe</caption>
          <thead>
            <tr>
              <th scope="col">Collègue</th>
              {days.map((day, index) => (
                <th scope="col" key={dateKey(day)} className={weekCellClass(day, index, todayKey)} aria-label={tomorrowDateFormatter.format(day)}>
                  <span aria-hidden="true">{WEEKDAY_INITIALS[index]}</span>
                  <b aria-hidden="true">{day.getDate()}</b>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([1, 2, 3] as const).map((group) => {
              const groupRows = rows.filter((row) => row.group === group);
              if (!groupRows.length) return null;
              return <Fragment key={group}>
                <tr className={`colleague-tomorrow-group group-${group}`}><th scope="rowgroup" colSpan={8}><span className="colleague-tomorrow-group-label"><b aria-hidden="true">{group}</b>Groupe {group}</span></th></tr>
                {groupRows.map((row) => (
                  <tr key={row.id} className={row.isSelf ? "is-self" : ""}>
                    <th scope="row">{row.onOpen ? <button type="button" className="colleague-row-open" onClick={row.onOpen} aria-label={`Voir le planning de ${row.name}`}>{row.name}</button> : row.name}</th>
                    {days.map((day, index) => {
                      const status = row.statusFor(day);
                      return (
                        <td key={dateKey(day)} className={weekCellClass(day, index, todayKey)}>
                          <span className={`colleague-week-cell ${tomorrowStatusTone(status)}`} title={status}>
                            <span aria-hidden="true">{WEEK_STATUS_LETTERS[status]}</span>
                            <span className="colleague-week-sr">{status}</span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>;
            })}
          </tbody>
        </table>
      </div>
      <ul className="colleague-week-legend" aria-label="Légende">
        <li><span className="colleague-week-cell work" aria-hidden="true">T</span>Travail</li>
        <li><span className="colleague-week-cell training" aria-hidden="true">F</span>Formation</li>
        <li><span className="colleague-week-cell rest" aria-hidden="true">R</span>Repos</li>
        <li><span className="colleague-week-cell absence" aria-hidden="true">A</span>Absence</li>
        <li><span className="colleague-week-cell partial" aria-hidden="true">½</span>Demi-journée</li>
      </ul>
    </div>
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

export function ColleaguePlanningPage({ demoMode, initialName, accountId = "", getOwnPresence, ownGroup, isAdmin = false }: Props) {
  // Le dernier état connu s'affiche d'emblée ; la lecture du serveur le met à
  // jour ensuite sans vider le tableau.
  const [cached] = useState(() => demoMode ? null : readColleagueBoardCache(accountId));
  const [data, setData] = useState<ColleagueDirectory | null>(demoMode ? demoDirectory : cached?.directory ?? null);
  const [name, setName] = useState(initialName || (demoMode ? demoDirectory.self.displayName : cached?.directory.self.displayName ?? ""));
  const [query, setQuery] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(!demoMode && !cached);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SharedColleaguePlanning | null>(null);
  const [view, setView] = useState(() => startOfMonth(new Date()));
  const [receivedPlannings, setReceivedPlannings] = useState<Record<string, SharedColleaguePlanning>>(() => cached?.plannings ?? {});
  const [planningRefresh, setPlanningRefresh] = useState(0);
  const directoryRead = useRef(false);
  const planningsRef = useRef(receivedPlannings);
  planningsRef.current = receivedPlannings;
  const [boardOffset, setBoardOffset] = useState(1);
  // La semaine s'ouvre d'abord : on y voit d'un coup qui est là les prochains jours.
  const [boardMode, setBoardMode] = useState<"day" | "week">("week");
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
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
    try {
      const next = await getColleagueDirectory();
      setData(next);
      // La première lecture suffit à charger les plannings ; les suivantes les relisent.
      if (directoryRead.current) setPlanningRefresh((value) => value + 1);
      directoryRead.current = true;
      setName((current) => current || next.self.displayName);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le partage est indisponible.");
    } finally { setDirectoryLoading(false); }
  }, [demoMode]);

  useEffect(() => { void refresh(); }, [refresh]);
  // Le dernier état connu est gardé : inutile de tout relire chaque minute.
  // On relit au retour sur l'application (au plus une fois par minute) et
  // après un enregistrement réussi, ce qui épargne batterie et données.
  useEffect(() => {
    if (demoMode) return;
    let lastRead = Date.now();
    const update = () => {
      lastRead = Date.now();
      void refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRead > 60_000) update();
    };
    const onSync = (event: Event) => {
      if ((event as CustomEvent<{ status?: string }>).detail?.status === "saved") update();
    };
    window.addEventListener("calendar-sync", onSync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("calendar-sync", onSync);
      document.removeEventListener("visibilitychange", onVisible);
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

  // Depuis le tableau, le planning déjà lu s'ouvre aussitôt sur le mois regardé.
  const openFromBoard = (ownerId: string, date: Date) => {
    setView(startOfMonth(date));
    const known = receivedPlannings[ownerId];
    if (known) setSelected(known);
    else void openPlanning(ownerId);
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

  // Les plannings déjà affichés restent en place pendant leur relecture : le
  // tableau ne se vide plus à chaque rafraîchissement de l'annuaire.
  const receivedKey = received.map((share) => share.ownerId).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: receivedKey résume `received` ; tomorrowAttempt et planningRefresh relancent les lectures.
  useEffect(() => {
    setTomorrowFailed([]);
    const ids = new Set(received.map((share) => share.ownerId));
    setReceivedPlannings((current) => Object.fromEntries(Object.entries(current).filter(([ownerId]) => ids.has(ownerId))));
    if (!received.length) return;
    let cancelled = false;
    for (const share of received) void (async () => {
      try {
        const planning = demoMode ? demoPlanning : await getSharedColleaguePlanning(share.ownerId);
        if (!cancelled) setReceivedPlannings((current) => ({ ...current, [share.ownerId]: planning }));
      } catch {
        // Un planning déjà connu reste affiché ; seul un planning jamais lu est signalé.
        if (!cancelled && !planningsRef.current[share.ownerId]) setTomorrowFailed((failed) => [...failed, share.ownerId]);
      }
    })();
    return () => { cancelled = true; };
  }, [demoMode, receivedKey, tomorrowAttempt, planningRefresh]);

  useEffect(() => {
    if (demoMode || !data) return;
    writeColleagueBoardCache(accountId, { directory: data, plannings: receivedPlannings });
  }, [accountId, data, demoMode, receivedPlannings]);

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
  const howItWorksCard = (
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
  );
  const profileCard = (
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
  );
  const settingsCards = <>{howItWorksCard}{profileCard}</>;
  // Le nom sous lequel les collègues vous trouvent, lisible dès l'arrivée.
  const directoryName = data?.self.displayName || name.trim();
  const boardVisible = Boolean(data?.self.visible && received.length);
  const directoryCount = data?.directory.length || 0;

  return (
    <section className={`colleague-sharing-page${boardVisible ? " has-board" : ""}`}>
      {error ? <p className="colleague-error" role="alert">{error}</p> : null}

      <header className="colleague-sharing-intro colleague-share-disclosure">
        <p className="eyebrow">Partage privé</p>
        <h2>Planning des collègues</h2>
        <div className="colleague-intro-body">
          <div className="colleague-identity">
            <span className="colleague-identity-avatar" aria-hidden="true">{directoryName.charAt(0).toLocaleUpperCase("fr") || "?"}</span>
            <span className="colleague-identity-copy">
              <small>Votre nom dans l’annuaire</small>
              <span className="colleague-identity-name">
                <strong>{directoryName || "Nom à choisir"}</strong>
                {/* La pastille est aussi l'interrupteur : un clic masque votre nom
                    de l'annuaire, un autre le rend de nouveau visible. */}
                {data ? <button
                  type="button"
                  className={`colleague-identity-status${data.self.visible ? " is-visible" : ""}`}
                  disabled={busy || directoryName.length < 2}
                  aria-label={data.self.visible ? "Visible dans l’annuaire : masquer mon nom" : "Masqué dans l’annuaire : afficher mon nom"}
                  title={data.self.visible ? "Masquer mon nom dans l’annuaire" : "Afficher mon nom dans l’annuaire"}
                  onClick={() => confirmMutation(
                    data.self.visible
                      ? "Masquer votre nom dans l’annuaire ? Vos collègues ne pourront plus vous trouver."
                      : `Rendre « ${directoryName} » visible dans l’annuaire ?`,
                    { action: "set-profile", displayName: directoryName, visible: !data.self.visible },
                  )}
                >
                  {data.self.visible ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg> : null}
                  {data.self.visible ? "Visible" : "Masqué"}
                </button> : null}
              </span>
            </span>
            {/* Une fois inscrit, les réglages s'ouvrent d'ici ; avant, ils sont
                affichés dans la page. */}
            {settingsCollapsed ? <button className="colleague-identity-edit" type="button" aria-haspopup="dialog" aria-label="Modifier mon nom dans l’annuaire" onClick={() => setSettingsOpen(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
              Modifier
            </button> : null}
          </div>
          <p>Vous ne partagez que vos jours de présence et d’absence : vos notes, votre paie et le reste restent privés.</p>
        </div>
      </header>

      {/* Ce qui sert chaque jour vient en premier : qui travaille, jour par jour. */}
      {boardVisible ? <section className="colleague-card colleague-tomorrow colleague-day-board" aria-labelledby="colleague-tomorrow-title">
        <header className="colleague-tomorrow-heading">
          <div><p className="eyebrow">En un coup d’œil</p><h4 id="colleague-tomorrow-title">{boardMode === "day" ? colleagueBoardTitle(boardOffset) : colleagueWeekTitle(weekOffset)}</h4></div>
          <div className="colleague-day-steps">
            {boardMode === "day" ? <>
              <button className="period-step" type="button" aria-label="Jour précédent" disabled={boardOffset <= 0} onClick={() => setBoardOffset((offset) => Math.max(0, offset - 1))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg></button>
              <button className="period-step" type="button" aria-label="Jour suivant" disabled={boardOffset >= BOARD_MAX_OFFSET} onClick={() => setBoardOffset((offset) => Math.min(BOARD_MAX_OFFSET, offset + 1))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg></button>
            </> : <>
              <button className="period-step" type="button" aria-label="Semaine précédente" disabled={weekOffset <= 0} onClick={() => setWeekOffset((offset) => Math.max(0, offset - 1))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg></button>
              <button className="period-step" type="button" aria-label="Semaine suivante" disabled={weekOffset >= BOARD_MAX_WEEK_OFFSET} onClick={() => setWeekOffset((offset) => Math.min(BOARD_MAX_WEEK_OFFSET, offset + 1))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg></button>
            </>}
          </div>
        </header>
        {/* Un jour pour savoir qui est là ; une semaine pour préparer un échange.
            À droite, la composition des trois groupes s'ouvre dans une fenêtre. */}
        <div className="colleague-board-toolbar">
          {/* Une pastille glisse d'un choix à l'autre. */}
          <div className="colleague-board-mode" role="group" aria-label="Affichage" data-mode={boardMode}>
            <button type="button" className={boardMode === "day" ? "active" : ""} aria-pressed={boardMode === "day"} onClick={() => setBoardMode("day")}>Jour</button>
            <button type="button" className={boardMode === "week" ? "active" : ""} aria-pressed={boardMode === "week"} onClick={() => setBoardMode("week")}>Semaine</button>
          </div>
          <button className="colleague-groups-open" type="button" aria-haspopup="dialog" onClick={() => setGroupsOpen(true)}>
            <span className="colleague-groups-open-label">Détails des <span className="colleague-groups-open-count">3 </span>groupes</span>
            <span className="colleague-groups-open-badges" aria-hidden="true"><b className="group-1">1</b><b className="group-2">2</b><b className="group-3">3</b></span>
          </button>
        </div>
        {groupsOpen ? <ColleagueGroupsDialog
          groups={demoMode ? demoGroups : data?.groups}
          isAdmin={isAdmin && !demoMode}
          onClose={() => setGroupsOpen(false)}
        /> : null}
        {received.some((share) => !tomorrowSummaries[share.ownerId] && !tomorrowFailed.includes(share.ownerId)) ? <div className="colleague-tomorrow-pending" role="status"><span className="colleague-loading-spinner" aria-hidden="true" /> Analyse des plannings en cours…</div> : null}
        {boardMode === "week" ? <ColleagueWeekTable
          days={colleagueWeekDays(weekOffset)}
          rows={[
            ...(getOwnPresence && ownGroup ? [{ id: "self", name: selfName, group: ownGroup, isSelf: true, statusFor: (date: Date) => personalTomorrowStatus(getOwnPresence(date)) }] : []),
            ...received.filter((share) => receivedPlannings[share.ownerId]).map((share) => ({
              id: share.ownerId,
              name: share.ownerName,
              group: receivedPlannings[share.ownerId].group,
              isSelf: false,
              statusFor: (date: Date) => sharedPlanningDayStatus(receivedPlannings[share.ownerId], date),
              onOpen: () => openFromBoard(share.ownerId, colleagueWeekDays(weekOffset)[0]),
            })),
          ]}
        /> : <>
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
                      <td><strong><button type="button" className="colleague-row-open" onClick={() => openFromBoard(share.ownerId, boardDate)} aria-label={`Voir le planning de ${share.ownerName}`}>{share.ownerName}</button></strong></td>
                      <td><span className={`colleague-tomorrow-status ${tomorrowStatusTone(summary.status)}`}><i aria-hidden="true" />{summary.status}</span></td>
                    </tr>;
                  })}
                </Fragment>;
              })}
              {tomorrowFailed.length > 0 ? <tr className="colleague-tomorrow-error"><td colSpan={2}><p role="status">Planning indisponible : {received.filter((share) => tomorrowFailed.includes(share.ownerId)).map((share) => share.ownerName).join(", ")}.</p><button type="button" onClick={() => setTomorrowAttempt((value) => value + 1)}>Réessayer</button></td></tr> : null}
            </tbody>
          </table>
        </div>
        </>}
      </section> : null}

      {/* À la première visite, ou tant qu'on n'est pas inscrit, l'aide et le
          profil restent dépliés, juste sous ce qui sert chaque jour. */}
      {/* Sur grand écran, ce qui accompagne le tableau forme une colonne à sa
          droite ; ailleurs, cette colonne s'efface et tout reste empilé. */}
      <div className="colleague-side">
      {settingsCollapsed ? null : settingsCards}

      <button className="colleague-card colleague-share-open" type="button" aria-haspopup="dialog" onClick={() => setShareOpen(true)}>
        <span className="colleague-share-open-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M10 14 21 3M21 3l-6.5 18-3.5-7-7-3.5z" /></svg>
        </span>
        <span className="colleague-share-open-copy">
          <strong>Partager mon planning</strong>
          <small>{directoryCount} collègue{directoryCount > 1 ? "s" : ""} disponible{directoryCount > 1 ? "s" : ""} dans l’annuaire</small>
        </span>
        <svg className="colleague-share-open-go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </button>

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

      {/* Sans le tableau « Qui travaille ? », les groupes restent ici. */}
      {!demoMode && !boardVisible ? <section className="colleague-card colleague-more-list" aria-label="Équipe">
        <ColleagueGroupsDirectory groups={data?.groups} isAdmin={isAdmin} />
      </section> : null}

      {data?.blocked.length ? <section className="colleague-card"><p className="eyebrow">Noms bloqués</p><h3>Gérer mes blocages</h3><p>Ces personnes ne peuvent pas vous trouver ni vous envoyer leur planning.</p><div className="colleague-list">{data.blocked.map((person) => <div key={person.userId}><strong>{person.displayName}</strong><button className="secondary" type="button" disabled={busy} onClick={() => confirmMutation(`Débloquer ${person.displayName} ?`, { action: "unblock-person", userId: person.userId })}>Débloquer</button></div>)}</div></section> : null}
      </div>

      {settingsOpen ? <ColleagueDialog id="colleague-settings-title" eyebrow="Partage privé" title="Réglages du partage" className="colleague-settings-dialog" onClose={() => setSettingsOpen(false)}>
        {error ? <p className="colleague-error" role="alert">{error}</p> : null}
        {profileCard}
        {howItWorksCard}
      </ColleagueDialog> : null}
      {shareOpen ? <ColleagueDialog id="colleague-share-title" eyebrow="Annuaire" title="Partager mon planning" className="colleague-share-dialog" onClose={() => setShareOpen(false)}>
        {error ? <p className="colleague-error" role="alert">{error}</p> : null}
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
      </ColleagueDialog> : null}
    </section>
  );
}
