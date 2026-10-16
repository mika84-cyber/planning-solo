import { useEffect, useId, useState, type Dispatch, type SetStateAction } from "react";
import { ClockTimePicker } from "./ClockTimePicker";
import { searchColleagueGroups } from "./ColleagueGroupsDirectory";
import type { ColleagueGroup } from "./colleagueGroups";
import { getColleagueGroups } from "./colleagueSharingApi";
import { fromKey, getDayInfo } from "./planningLogic";
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
  // Remplacement seul : uniquement dans l'onglet « Jour férié ».
  const replacement = holidayTab && Boolean(draft.replacement);
  const partner = draft.partnerName.trim();
  const giveHolidays = holidayTab ? holidaysForExchangeGive(group, new Date()) : [];
  const chooseTab = (holiday: boolean) => {
    if (holiday === holidayTab) return;
    setHolidayTab(holiday);
    setDraft((current) => ({ ...current, agreementDate: "", returnDate: "", replacement: false }));
  };
  /* Votre journée fixe le groupe du collègue : l'un de ceux qui sont en
     repos ce jour-là. Sa journée est à refaire si le groupe change. */
  const chooseAgreement = (agreementDate: string, partnerGroup?: number) =>
    setDraft((current) => {
      const off = [1, 2, 3].filter((other) => other !== group && getDayInfo(fromKey(agreementDate), other).kind === "off");
      const nextGroup = partnerGroup ?? (off.includes(current.partnerGroup) ? current.partnerGroup : off[0] ?? current.partnerGroup);
      return { ...current, agreementDate, partnerGroup: nextGroup, returnDate: nextGroup === current.partnerGroup ? current.returnDate : "" };
    });
  const dayLabel = (key: string) => fromKey(key).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const holidayButton = (holiday: { key: string; name: string }, selected: boolean, onPick: () => void) => (
    <button key={holiday.key} type="button" role="radio" aria-checked={selected} className={`xch-choice${selected ? " selected" : ""}`} onClick={onPick}>
      <strong>{holiday.name}</strong>
      <small>{dayLabel(holiday.key)}</small>
    </button>
  );
  /* Les horaires de chaque journée figurent sur la demande. */
  const hours = (label: string, startKey: "agreementStart" | "returnStart", endKey: "agreementEnd" | "returnEnd") => (
    <div className="xch-hours" role="group" aria-label={label}>
      <ClockTimePicker label="De" value={draft[startKey]} allowEmpty emptyLabel="—" onChange={(value) => setDraft((current) => ({ ...current, [startKey]: value }))} />
      <ClockTimePicker label="À" value={draft[endKey]} allowEmpty emptyLabel="—" onChange={(value) => setDraft((current) => ({ ...current, [endKey]: value }))} />
    </div>
  );
  const sheet = !holidayTab
    ? { title: "1 demande d’échange", detail: "Vos deux journées figurent sur la même feuille." }
    : replacement
      ? { title: "1 demande de remplacement", detail: "Votre collègue travaille votre férié, sans férié rendu." }
      : { title: "2 demandes de remplacement", detail: "Un férié ne se cède pas avec une demande d’échange : une feuille pour votre férié, une pour le sien." };
  const noun = holidayTab ? "férié" : "journée";
  const complete = Boolean(draft.agreementDate && partner && (replacement || draft.returnDate));
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
        <h2 id="work-exchange-title">
          {editing ? replacement ? "Modifier le remplacement" : "Modifier l’échange" : "Faire un échange"}
        </h2>
        <div className="xch-tabs" role="tablist" aria-label="Type d’échange">
          {([[false, "Journée"], [true, "Jour férié"]] as const).map(([holiday, label]) => (
            <button key={label} type="button" role="tab" aria-selected={holidayTab === holiday} className={holidayTab === holiday ? "active" : undefined} onClick={() => chooseTab(holiday)}>
              {label}
            </button>
          ))}
        </div>

        {/* Ce que l'échange produira : la ou les feuilles à faire signer. */}
        <div className="xch-sheet" aria-live="polite">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>
          <div>
            <strong>{sheet.title}</strong>
            <small>{sheet.detail}</small>
            {holidayTab ? (
              <label className="xch-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={replacement}
                  onChange={(event) => setDraft((current) => ({ ...current, replacement: event.target.checked, returnDate: event.target.checked ? "" : current.returnDate }))}
                />
                <span>Remplacement seul, sans férié rendu</span>
              </label>
            ) : null}
          </div>
        </div>

        <ol className="xch-steps">
          <li>
            <header>
              <b aria-hidden="true">1</b>
              <div>
                <strong>Votre {noun}</strong>
                <small>Groupe {group} · {partner || "Votre collègue"} vous remplace</small>
              </div>
            </header>
            {holidayTab ? (
              <div className="xch-choices" role="radiogroup" aria-label="Choisir le férié que vous cédez">
                {giveHolidays.length ? giveHolidays.map((holiday) => holidayButton(holiday, draft.agreementDate === holiday.key, () =>
                  chooseAgreement(holiday.key, holiday.partnerGroup),
                )) : <p className="xch-empty">Aucun férié travaillé dans les douze prochains mois.</p>}
              </div>
            ) : (
              <WorkExchangeDatePicker
                value={draft.agreementDate}
                ownerGroup={group}
                otherGroup={partner ? draft.partnerGroup : 0}
                excludeHolidays
                ariaLabel="Choisir la journée de votre cycle"
                onChange={(agreementDate) => chooseAgreement(agreementDate)}
              />
            )}
            {hours("Horaires de la journée de votre cycle", "agreementStart", "agreementEnd")}
          </li>

          <li>
            <header>
              <b aria-hidden="true">2</b>
              <div>
                <strong>Votre collègue</strong>
                <small>
                  {offGroups.length
                    ? `En repos ce jour-là : ${offGroups.length > 1 ? `groupes ${offGroups.join(" et ")}` : `groupe ${offGroups[0]}`}`
                    : "D’un autre groupe que le vôtre"}
                </small>
              </div>
            </header>
            <label className="xch-person">
              <span className="visually-hidden">Collègue</span>
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
            {/* Le groupe se déduit de votre journée ; seuls ceux en repos ce
                jour-là restent possibles. */}
            <div className="xch-groups" role="radiogroup" aria-label="Choisir le groupe du collègue">
              {[1, 2, 3].filter((other) => other !== group).map((other) => {
                const possible = !offGroups.length || offGroups.includes(other);
                return (
                  <button
                    key={other}
                    type="button"
                    role="radio"
                    aria-checked={draft.partnerGroup === other}
                    disabled={!possible}
                    className={`group-${other}${draft.partnerGroup === other ? " selected" : ""}`}
                    onClick={() => setDraft((current) => ({ ...current, partnerGroup: other, returnDate: other === current.partnerGroup ? current.returnDate : "" }))}
                  >
                    Groupe {other}
                  </button>
                );
              })}
            </div>
          </li>

          {replacement ? null : (
            <li>
              <header>
                <b aria-hidden="true">3</b>
                <div>
                  <strong>{holidayTab ? "Son férié" : "Sa journée"}</strong>
                  <small>Groupe {draft.partnerGroup} · Vous remplacez {partner || "votre collègue"}</small>
                </div>
              </header>
              {!draft.agreementDate ? (
                <p className="xch-empty">Choisissez d’abord votre {noun}.</p>
              ) : holidayTab ? (
                /* Un férié se rend par un férié : la liste de ceux possibles. */
                <div className="xch-choices" role="radiogroup" aria-label="Choisir le férié du cycle du collègue">
                  {returnHolidays.length ? returnHolidays.map((holiday) => holidayButton(holiday, draft.returnDate === holiday.key, () =>
                    setDraft((current) => ({ ...current, returnDate: holiday.key })),
                  )) : <p className="xch-empty">Aucun férié travaillé par le groupe {draft.partnerGroup} où vous êtes en repos.</p>}
                </div>
              ) : (
                <WorkExchangeDatePicker
                  value={draft.returnDate}
                  ownerGroup={draft.partnerGroup}
                  otherGroup={group}
                  excludeHolidays
                  ariaLabel="Choisir la journée du cycle du collègue"
                  onChange={(returnDate) => setDraft((current) => ({ ...current, returnDate }))}
                />
              )}
              {hours("Horaires de la journée de son cycle", "returnStart", "returnEnd")}
            </li>
          )}
        </ol>

        {/* En une phrase, qui remplace qui et quand. */}
        {complete ? (
          <p className="xch-recap">
            <span>{partner} vous remplace le {dayLabel(draft.agreementDate)}.</span>
            {replacement ? null : <span>Vous remplacez {partner} le {dayLabel(draft.returnDate)}.</span>}
          </p>
        ) : null}
        {error ? <p className="work-exchange-error" role="alert">{error}</p> : null}
        <div className="xch-actions">
          {editing ? (
            <button className="xch-delete" type="button" onClick={onDelete} disabled={saving}>
              {replacement ? "Supprimer le remplacement" : "Supprimer l’échange"}
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
          <button className="save-button" type="button" onClick={onSave} disabled={saving}>
            {saving ? "Synchronisation…" : editing ? "Enregistrer les modifications" : replacement ? "Valider le remplacement" : "Valider l’échange"}
          </button>
        </div>
      </section>
    </div>
  );
}
