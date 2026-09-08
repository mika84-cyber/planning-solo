import type { ColleagueGroup } from "./colleagueGroups";
import "./colleagueGroupsDirectory.css";

type Props = { groups?: readonly ColleagueGroup[] };

export function ColleagueGroupsDirectory({ groups = [] }: Props) {
  const total = groups.reduce(
    (sum, group) => sum + group.members.length,
    0,
  );

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
        {groups.map((group) => (
          <details className={`colleague-group-card group-${group.number}`} key={group.number}>
            <summary>
              <span><strong>Groupe {group.number}</strong><small>{group.members.length} personnes</small></span>
              <i aria-hidden="true">⌄</i>
            </summary>
            <ol>
              {group.members.map((member) => <li key={member}>{member}</li>)}
            </ol>
          </details>
        ))}
      </div>
    </details>
  );
}
