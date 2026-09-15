import { useEffect, useId, useState, type Dispatch, type SetStateAction } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { searchColleagueGroups } from "./ColleagueGroupsDirectory";
import type { ColleagueGroup } from "./colleagueGroups";
import { colleagueObjectPronoun } from "./colleaguePronoun";
import { getColleagueGroups } from "./colleagueSharingApi";
import { GROUP_OPTIONS } from "./planningLogic";
import { normalizeSearchText } from "./searchMatching";
import { WorkExchangeDatePicker } from "./WorkExchangeDatePicker";
import type { WorkExchangeDraft } from "./workExchange";

type Props = {
  open: boolean;
  demoMode?: boolean;
  group: number;
  draft: WorkExchangeDraft;
  setDraft: Dispatch<SetStateAction<WorkExchangeDraft>>;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

/* Annuaire fictif de la démo : les vrais noms ne quittent jamais le serveur
   et ne sont servis qu'aux personnes connectées. */
const DEMO_DIRECTORY: readonly ColleagueGroup[] = [
  { number: 1, members: ["Camille Durand", "Claire Martin", "Hugo Bernard", "Inès Robert", "Lucas Petit"] },
  { number: 2, members: ["Julie Roux", "Marc Blanc", "Sarah Lambert"] },
  { number: 3, members: ["Chloé Moreau", "Karim Lefèvre", "Léa Garnier", "Nora Faure", "Théo Girard"] },
];

function initiales(nom: string) {
  return nom.split(/\s+/).filter(Boolean).slice(0, 2).map((mot) => mot[0]).join("").toLocaleUpperCase("fr");
}

export function WorkExchangeDialog({
  open,
  demoMode = false,
  group,
  draft,
  setDraft,
  error,
  saving,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [annuaire, setAnnuaire] = useState<readonly ColleagueGroup[]>([]);
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const [suggestionActive, setSuggestionActive] = useState(-1);
  const listeId = useId();

  /* L'annuaire des collègues sert déjà ailleurs : il donne le nom et le
     groupe, exactement ce qu'il faut ici pour éviter une double saisie. */
  useEffect(() => {
    if (!open || annuaire.length) return;
    if (demoMode) {
      setAnnuaire(DEMO_DIRECTORY);
      return;
    }
    let actif = true;
    void getColleagueGroups()
      .then((groupes) => { if (actif) setAnnuaire(groupes); })
      .catch(() => undefined);
    return () => { actif = false; };
  }, [open, annuaire.length, demoMode]);

  /* Un échange n'a de sens qu'entre deux cycles différents : proposer un
     collègue de son propre groupe reviendrait à échanger deux journées
     identiques. Les noms dont un mot commence par les lettres tapées (le
     prénom, le plus souvent) passent devant. */
  const requete = normalizeSearchText(draft.partnerName);
  const commencePar = (nom: string) => normalizeSearchText(nom).split(" ").some((mot) => requete && mot.startsWith(requete));
  const suggestions = searchColleagueGroups(annuaire, draft.partnerName)
    .filter((item) => item.group !== group)
    .sort((a, b) => Number(commencePar(b.member)) - Number(commencePar(a.member)) || a.member.localeCompare(b.member, "fr"))
    .slice(0, 6);
  const listeVisible = suggestionsOuvertes && suggestions.length > 0;
  const choisirCollegue = (nom: string, groupe: number) => {
    setDraft((current) => ({ ...current, partnerName: nom, partnerGroup: groupe }));
    setSuggestionsOuvertes(false);
    setSuggestionActive(-1);
  };

  /* Les lettres tapées ressortent en terracotta dans chaque nom proposé. */
  const surligner = (nom: string) => {
    const mots = nom.split(" ");
    const position = requete ? mots.findIndex((mot) => normalizeSearchText(mot).startsWith(requete)) : -1;
    if (position < 0) return nom;
    const avant = mots.slice(0, position).join(" ");
    const mot = mots[position];
    const apres = mots.slice(position + 1).join(" ");
    return (
      <>
        {avant ? `${avant} ` : ""}
        <mark>{mot.slice(0, requete.length)}</mark>
        {mot.slice(requete.length)}
        {apres ? ` ${apres}` : ""}
      </>
    );
  };

  if (!open) return null;
  const editing = Boolean(draft.id);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card work-exchange-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-exchange-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
        <span className="step-label">Organisation entre collègues</span>
        <h2 id="work-exchange-title">{editing ? "Modifier l’échange" : "Enregistrer un échange"}</h2>
        <p>
          Les deux dates sont obligatoires et seront toujours enregistrées ensemble.
          L’échange ne modifie ni la paie ni les congés.
        </p>
        <div className="work-exchange-person-grid">
          <label>
            <span>Collègue</span>
            <input
              type="text"
              value={draft.partnerName}
              maxLength={80}
              autoComplete="off"
              placeholder="Prénom et/ou nom"
              role="combobox"
              aria-expanded={listeVisible}
              aria-controls={listeId}
              aria-autocomplete="list"
              aria-activedescendant={listeVisible && suggestionActive >= 0 ? `${listeId}-${suggestionActive}` : undefined}
              onFocus={() => setSuggestionsOuvertes(true)}
              onBlur={() => window.setTimeout(() => setSuggestionsOuvertes(false), 150)}
              onKeyDown={(event) => {
                if (!listeVisible) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const pas = event.key === "ArrowDown" ? 1 : -1;
                  setSuggestionActive((courant) => (courant + pas + suggestions.length) % suggestions.length);
                } else if (event.key === "Enter" && suggestionActive >= 0) {
                  event.preventDefault();
                  const item = suggestions[suggestionActive];
                  if (item) choisirCollegue(item.member, item.group);
                } else if (event.key === "Escape") {
                  setSuggestionsOuvertes(false);
                }
              }}
              onChange={(event) => {
                setSuggestionsOuvertes(true);
                setSuggestionActive(-1);
                setDraft((current) => ({ ...current, partnerName: event.target.value }));
              }}
            />
            {listeVisible ? (
              <ul className="work-exchange-suggestions" id={listeId} role="listbox" aria-label="Collègues proposés">
                {suggestions.map((item, index) => (
                  <li key={`${item.group}-${item.member}`}>
                    <button
                      type="button"
                      role="option"
                      id={`${listeId}-${index}`}
                      aria-selected={index === suggestionActive}
                      className={index === suggestionActive ? "active" : undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setSuggestionActive(index)}
                      onClick={() => choisirCollegue(item.member, item.group)}
                    >
                      <span className="work-exchange-suggestion-avatar" aria-hidden="true">{initiales(item.member)}</span>
                      <strong>{surligner(item.member)}</strong>
                      <small className={`work-exchange-suggestion-group group-${item.group}`}>Groupe {item.group}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
          <div className="work-exchange-group-field">
            <span>Son groupe</span>
            <ChoicePicker
              value={draft.partnerGroup}
              options={GROUP_OPTIONS.filter((option) => option.value !== group)}
              onChange={(partnerGroup) => setDraft((current) => ({ ...current, partnerGroup }))}
              ariaLabel="Choisir le groupe du collègue"
              className="work-exchange-group-picker"
            />
          </div>
        </div>

        <div className="work-exchange-date-grid">
          <label className="work-exchange-date-card agreement">
            <strong>Journée de votre cycle · Groupe {group}</strong>
            <span>Vous deviez travailler · {draft.partnerName.trim() || "Votre collègue"} vous remplace</span>
            <WorkExchangeDatePicker
              value={draft.agreementDate}
              ownerGroup={group}
              otherGroup={draft.partnerGroup}
              ariaLabel="Choisir la journée de votre cycle"
              onChange={(agreementDate) => setDraft((current) => ({ ...current, agreementDate }))}
            />
          </label>
          <label className="work-exchange-date-card return">
            <strong>Journée de son cycle · Groupe {draft.partnerGroup}</strong>
            <span>
              {draft.partnerName.trim() || "Votre collègue"} devait travailler · Vous {colleagueObjectPronoun(draft.partnerName)} remplacez
            </span>
            <WorkExchangeDatePicker
              value={draft.returnDate}
              ownerGroup={draft.partnerGroup}
              otherGroup={group}
              ariaLabel="Choisir la journée du cycle du collègue"
              onChange={(returnDate) => setDraft((current) => ({ ...current, returnDate }))}
            />
          </label>
        </div>

        {error ? <p className="work-exchange-error" role="alert">{error}</p> : null}
        <div className="modal-actions work-exchange-actions">
          {editing ? (
            <button className="delete-button" type="button" onClick={onDelete} disabled={saving}>
              Supprimer l’échange
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
          <button className="save-button" type="button" onClick={onSave} disabled={saving}>
            {saving ? "Synchronisation…" : editing ? "Enregistrer les modifications" : "Valider les deux dates"}
          </button>
        </div>
      </section>
    </div>
  );
}
