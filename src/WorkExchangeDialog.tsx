import { useEffect, useId, useState, type Dispatch, type SetStateAction } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { ClockTimePicker } from "./ClockTimePicker";
import { searchColleagueGroups } from "./ColleagueGroupsDirectory";
import type { ColleagueGroup } from "./colleagueGroups";
import { colleagueObjectPronoun } from "./colleaguePronoun";
import { getColleagueGroups } from "./colleagueSharingApi";
import { GROUP_OPTIONS, fromKey, getDayInfo } from "./planningLogic";
import { normalizeSearchText } from "./searchMatching";
import { WorkExchangeDatePicker } from "./WorkExchangeDatePicker";
import { holidaysForExchangeGive, holidaysForExchangeReturn, type WorkExchangeDraft } from "./workExchange";

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
  const [holidayTab, setHolidayTab] = useState(false);
  const listeId = useId();

  /* L'onglet « Jour férié » s'ouvre de lui-même quand le jour cédé en est un,
     au moment où la fenêtre s'ouvre. */
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setHolidayTab(Boolean(draft.agreementDate && getDayInfo(fromKey(draft.agreementDate), group).holiday));
  }

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
  /* Le jour cédé fixe le groupe du collègue : celui qui est en repos ce
     jour-là. Les noms proposés s'y limitent. */
  const agreementInfo = draft.agreementDate ? getDayInfo(fromKey(draft.agreementDate), group) : null;
  const offGroups = agreementInfo?.kind === "work"
    ? [1, 2, 3].filter((other) => other !== group && getDayInfo(fromKey(draft.agreementDate), other).kind === "off")
    : [];
  const returnHolidays = agreementInfo?.holiday ? holidaysForExchangeReturn(draft.agreementDate, group, draft.partnerGroup) : [];
  const suggestions = searchColleagueGroups(annuaire, draft.partnerName)
    .filter((item) => item.group !== group && (!offGroups.length || offGroups.includes(item.group)))
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
  const giveHolidays = holidayTab ? holidaysForExchangeGive(group, new Date()) : [];
  const chooseTab = (holiday: boolean) => {
    if (holiday === holidayTab) return;
    setHolidayTab(holiday);
    setDraft((current) => ({ ...current, agreementDate: "", returnDate: "" }));
  };
  const holidayButton = (holiday: { key: string; name: string }, selected: boolean, onPick: () => void) => (
    <button key={holiday.key} type="button" role="radio" aria-checked={selected} className={selected ? "selected" : undefined} onClick={onPick}>
      <strong>{holiday.name}</strong>
      <small>{fromKey(holiday.key).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</small>
    </button>
  );
  /* Les horaires de chaque journée figurent sur la demande d'échange. */
  const hours = (label: string, startKey: "agreementStart" | "returnStart", endKey: "agreementEnd" | "returnEnd") => (
    <div className="work-exchange-hours" role="group" aria-label={label}>
      <ClockTimePicker label="De" value={draft[startKey]} allowEmpty emptyLabel="—" onChange={(value) => setDraft((current) => ({ ...current, [startKey]: value }))} />
      <ClockTimePicker label="À" value={draft[endKey]} allowEmpty emptyLabel="—" onChange={(value) => setDraft((current) => ({ ...current, [endKey]: value }))} />
    </div>
  );
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
        <div className="work-exchange-tabs" role="tablist" aria-label="Type d’échange">
          {([[false, "Échange de jour"], [true, "Jour férié"]] as const).map(([holiday, label]) => (
            <button key={label} type="button" role="tab" aria-selected={holidayTab === holiday} className={holidayTab === holiday ? "active" : undefined} onClick={() => chooseTab(holiday)}>
              {label}
            </button>
          ))}
        </div>
        {offGroups.length ? (
          <p className="work-exchange-group-hint">
            {agreementInfo?.holiday ? `${agreementInfo.holiday} : ` : ""}
            le {fromKey(draft.agreementDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}, {offGroups.length > 1 ? `les groupes ${offGroups.join(" et ")} sont` : `le groupe ${offGroups[0]} est`} en repos.
            {" "}Échangez avec un collègue {offGroups.length > 1 ? "de l’un de ces groupes" : `du groupe ${offGroups[0]}`}.
          </p>
        ) : null}
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
          <div className="work-exchange-date-card agreement">
            <strong>{holidayTab ? "Férié de votre cycle" : "Journée de votre cycle"} · Groupe {group}</strong>
            <span>Vous deviez travailler · {draft.partnerName.trim() || "Votre collègue"} vous remplace</span>
            {holidayTab ? (
              <div className="work-exchange-holiday-list" role="radiogroup" aria-label="Choisir le férié que vous cédez">
                {giveHolidays.length ? giveHolidays.map((holiday) => holidayButton(holiday, draft.agreementDate === holiday.key, () =>
                  setDraft((current) => ({ ...current, agreementDate: holiday.key, returnDate: "", partnerGroup: holiday.partnerGroup })),
                )) : <small>Aucun férié travaillé dans les douze prochains mois.</small>}
              </div>
            ) : (
              <WorkExchangeDatePicker
                value={draft.agreementDate}
                ownerGroup={group}
                otherGroup={draft.partnerGroup}
                ariaLabel="Choisir la journée de votre cycle"
                onChange={(agreementDate) => setDraft((current) => ({ ...current, agreementDate }))}
              />
            )}
            {hours("Horaires de la journée de votre cycle", "agreementStart", "agreementEnd")}
          </div>
          <div className="work-exchange-date-card return">
            <strong>Journée de son cycle · Groupe {draft.partnerGroup}</strong>
            <span>
              {draft.partnerName.trim() || "Votre collègue"} devait travailler · Vous {colleagueObjectPronoun(draft.partnerName)} remplacez
              {agreementInfo?.holiday ? " · un jour férié, comme celui que vous cédez" : ""}
            </span>
            {holidayTab || agreementInfo?.holiday ? (
              /* Un férié se rend par un férié : la liste de ceux possibles,
                 plutôt que tout le calendrier. */
              <div className="work-exchange-holiday-list" role="radiogroup" aria-label="Choisir le férié du cycle du collègue">
                {returnHolidays.length ? returnHolidays.map((holiday) => holidayButton(holiday, draft.returnDate === holiday.key, () =>
                  setDraft((current) => ({ ...current, returnDate: holiday.key })),
                )) : <small>{holidayTab && !draft.agreementDate ? "Choisissez d’abord le férié que vous cédez." : `Aucun férié travaillé par le groupe ${draft.partnerGroup} où vous êtes en repos.`}</small>}
              </div>
            ) : (
              <WorkExchangeDatePicker
                value={draft.returnDate}
                ownerGroup={draft.partnerGroup}
                otherGroup={group}
                ariaLabel="Choisir la journée du cycle du collègue"
                onChange={(returnDate) => setDraft((current) => ({ ...current, returnDate }))}
              />
            )}
            {hours("Horaires de la journée de son cycle", "returnStart", "returnEnd")}
          </div>
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
