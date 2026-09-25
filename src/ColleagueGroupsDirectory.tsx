import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { adminToolsApi } from "./adminToolsApi";
import { type ColleagueGender, rememberColleagueGenders, useColleagueGenders } from "./colleagueGenders";
import type { ColleagueGroup } from "./colleagueGroups";
import { getColleagueGroups } from "./colleagueSharingApi";
import { matchesSearch } from "./searchMatching";
import "./colleagueGroupsDirectory.css";

type Props = {
  groups?: readonly ColleagueGroup[];
  /** L'administrateur indique ici le genre de chaque collègue. */
  isAdmin?: boolean;
};
const GROUP_COUNTS = [34, 36, 35] as const;
const EMPTY_GROUPS: readonly ColleagueGroup[] = [];
export function searchColleagueGroups(groups: readonly ColleagueGroup[], query: string) {
  if (!query.trim()) return [];
  return groups.flatMap((group) => group.members
    .filter((member) => matchesSearch(member, query))
    .map((member) => ({ member, group: group.number })));
}

/** Les groupes connus, lus sur le serveur quand la page ne les fournit pas. */
function useColleagueGroupsList(groups: readonly ColleagueGroup[]) {
  const [availableGroups, setAvailableGroups] = useState<readonly ColleagueGroup[]>(groups);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt déclenche une nouvelle lecture après Réessayer.
  useEffect(() => {
    setLoadError(false);
    if (groups.length) {
      setAvailableGroups(groups);
      return;
    }
    let active = true;
    void getColleagueGroups().then((next) => {
      if (active) setAvailableGroups(next);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [groups, attempt]);

  const visibleGroups = availableGroups.length
    ? availableGroups.map((group) => ({ ...group, count: group.members.length }))
    : GROUP_COUNTS.map((count, index) => ({ number: (index + 1) as 1 | 2 | 3, members: [] as readonly string[], count }));
  const total = availableGroups.length ? availableGroups.reduce(
    (sum, group) => sum + group.members.length,
    0,
  ) : GROUP_COUNTS.reduce((sum, count) => sum + count, 0);
  return { availableGroups, visibleGroups, total, loadError, retry: () => setAttempt((value) => value + 1) };
}

type GroupsList = ReturnType<typeof useColleagueGroupsList>;

/** La recherche et les trois groupes, chacun replié par défaut. */
function ColleagueGroupsPanel({ list, isAdmin }: { list: GroupsList; isAdmin: boolean }) {
  const { availableGroups, visibleGroups, loadError, retry } = list;
  const knownGenders = useColleagueGenders();
  // Choix H/F pas encore validés, par nom ; ils partent groupe par groupe.
  const [pendingGenders, setPendingGenders] = useState<Record<string, ColleagueGender>>({});
  const [savingGroup, setSavingGroup] = useState<number | null>(null);
  const [genderError, setGenderError] = useState("");
  const chooseGender = (member: string, gender: ColleagueGender) =>
    setPendingGenders((current) => ({ ...current, [member]: gender }));
  const validateGenders = async (groupNumber: number, members: readonly string[]) => {
    const choices = Object.fromEntries(members.filter((member) => pendingGenders[member]).map((member) => [member, pendingGenders[member]]));
    setSavingGroup(groupNumber);
    setGenderError("");
    try {
      await adminToolsApi({ action: "set-genders", genders: choices });
      rememberColleagueGenders(choices, true);
      setPendingGenders((current) => Object.fromEntries(Object.entries(current).filter(([member]) => !(member in choices))));
    } catch (error) {
      setGenderError(error instanceof Error ? error.message : "Les choix n’ont pas pu être enregistrés.");
    } finally {
      setSavingGroup(null);
    }
  };
  const [search, setSearch] = useState("");
  const searchResults = searchColleagueGroups(availableGroups, search);

  return (
    <div className="colleague-groups-panel">
      <label className="colleague-groups-search">
        <span>Rechercher un collègue</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Prénom ou nom" />
      </label>
      {search.trim() ? <div className="colleague-groups-results" aria-live="polite">
        {searchResults.length ? <ul>
          {searchResults.map((result) => <li key={`${result.group}-${result.member}`}>
            <strong>{result.member}</strong>
            <span className={`group-${result.group}`}>Groupe {result.group}</span>
          </li>)}
        </ul> : <p>{!availableGroups.length ? loadError ? "Impossible de charger les noms." : "Chargement des noms…" : "Aucun collègue trouvé."}</p>}
      </div> : <div className="colleague-groups-content">
        {visibleGroups.map((group) => {
          // Seuls les noms sans genre enregistré proposent H/F, et à
          // l'administrateur seulement : une fois validés, ils disparaissent.
          const missing = isAdmin ? group.members.filter((member) => !knownGenders[member]) : [];
          const chosen = missing.filter((member) => pendingGenders[member]).length;
          return (
            <details className={`colleague-group-card group-${group.number}`} key={group.number}>
              <summary>
                <span><strong>Groupe {group.number}</strong><small>{group.count} personnes{missing.length ? ` · ${missing.length} sans H/F` : ""}</small></span>
                <i aria-hidden="true">⌄</i>
              </summary>
              {group.members.length ? <ol>
                {group.members.map((member) => <li key={member}>
                  <span>{member}</span>
                  {missing.includes(member) ? <span className="colleague-gender-choice" role="group" aria-label={`Genre de ${member}`}>
                    {(["h", "f"] as const).map((gender) => <button
                      key={gender}
                      type="button"
                      aria-pressed={pendingGenders[member] === gender}
                      aria-label={`${member} : ${gender === "h" ? "homme" : "femme"}`}
                      onClick={() => chooseGender(member, gender)}
                    >{gender.toUpperCase()}</button>)}
                  </span> : null}
                </li>)}
              </ol> : <p className="colleague-group-loading">{loadError ? "Noms indisponibles" : "Chargement des noms…"}</p>}
              {chosen ? <button
                type="button"
                className="colleague-gender-validate"
                disabled={savingGroup === group.number}
                onClick={() => void validateGenders(group.number, missing)}
              >{savingGroup === group.number ? "Enregistrement…" : `Valider ${chosen} choix`}</button> : null}
            </details>
          );
        })}
        {genderError ? <p className="colleague-gender-error" role="alert">{genderError}</p> : null}
      </div>}
      {loadError ? <div role="status"><p>Les noms sont momentanément indisponibles.</p><button type="button" onClick={retry}>Réessayer</button></div> : null}
    </div>
  );
}

/** Le volet dépliable de la liste « Partage, équipe et réglages », gardé pour
 *  quand le tableau « Qui travaille ? » n'est pas affiché. */
export function ColleagueGroupsDirectory({ groups = EMPTY_GROUPS, isAdmin = false }: Props) {
  const list = useColleagueGroupsList(groups);
  return (
    <details className="colleague-card colleague-groups-directory">
      <summary>
        <span className="colleague-groups-folder" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3.5 7.5h6l2-2h9v13h-17z" /></svg>
        </span>
        <span className="colleague-groups-heading">
          <span className="eyebrow">Organisation de l’équipe</span>
          <strong>Détails des 3 groupes</strong>
          <small>{list.total} collègues classés par groupe</small>
        </span>
        <span className="colleague-groups-caret" aria-hidden="true">⌄</span>
      </summary>
      <ColleagueGroupsPanel list={list} isAdmin={isAdmin} />
    </details>
  );
}

/** La même liste dans une fenêtre, ouverte par le bouton posé à côté de
 *  Jour / Semaine. Les trois groupes s'ouvrent repliés. La fenêtre est posée
 *  sur la page entière, hors du tableau et de ses défilements. */
export function ColleagueGroupsDialog({ groups = EMPTY_GROUPS, isAdmin = false, onClose }: Props & { onClose: () => void }) {
  const list = useColleagueGroupsList(groups);
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card colleague-groups-dialog" role="dialog" aria-modal="true" aria-labelledby="colleague-groups-dialog-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
        <span className="step-label">Organisation de l’équipe</span>
        <h2 id="colleague-groups-dialog-title">Détails des 3 groupes</h2>
        <p>{list.total} collègues classés par groupe</p>
        <ColleagueGroupsPanel list={list} isAdmin={isAdmin} />
      </section>
    </div>,
    document.body,
  );
}
