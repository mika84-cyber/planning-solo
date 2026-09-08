import { useEffect, useState } from "react";
import type { ColleagueGroup } from "./colleagueGroups";
import { getColleagueGroups } from "./colleagueSharingApi";
import "./colleagueGroupsDirectory.css";

type Props = { groups?: readonly ColleagueGroup[] };
const GROUP_COUNTS = [34, 36, 35] as const;

export function ColleagueGroupsDirectory({ groups = [] }: Props) {
  const [availableGroups, setAvailableGroups] = useState<readonly ColleagueGroup[]>(groups);

  useEffect(() => {
    if (groups.length) {
      setAvailableGroups(groups);
      return;
    }
    let active = true;
    void getColleagueGroups().then((next) => {
      if (active) setAvailableGroups(next);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [groups]);

  const visibleGroups = availableGroups.length
    ? availableGroups.map((group) => ({ ...group, count: group.members.length }))
    : GROUP_COUNTS.map((count, index) => ({ number: (index + 1) as 1 | 2 | 3, members: [] as readonly string[], count }));
  const total = availableGroups.length ? availableGroups.reduce(
    (sum, group) => sum + group.members.length,
    0,
  ) : GROUP_COUNTS.reduce((sum, count) => sum + count, 0);

  return (
    <details className="colleague-card colleague-groups-directory">
      <summary>
        <span className="colleague-groups-folder" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3.5 7.5h6l2-2h9v13h-17z" /></svg>
        </span>
        <span className="colleague-groups-heading">
          <span className="eyebrow">Organisation de l’équipe</span>
          <strong>Détails des 3 groupes</strong>
          <small>{total} collègues classés par groupe</small>
        </span>
        <span className="colleague-groups-caret" aria-hidden="true">⌄</span>
      </summary>

      <div className="colleague-groups-content">
        {visibleGroups.map((group) => (
          <details className={`colleague-group-card group-${group.number}`} key={group.number}>
            <summary>
              <span><strong>Groupe {group.number}</strong><small>{group.count} personnes</small></span>
              <i aria-hidden="true">⌄</i>
            </summary>
            {group.members.length ? <ol>
              {group.members.map((member) => <li key={member}>{member}</li>)}
            </ol> : <p className="colleague-group-loading">Chargement des noms…</p>}
          </details>
        ))}
      </div>
    </details>
  );
}
