import { useEffect, useState, type ReactNode } from "react";
import { useHelpTarget } from "./helpTargets";

type ResourceTab = "forms" | "contacts";

type UsefulResourcesHubProps = {
  forms: ReactNode;
  contacts: ReactNode;
  initialTab?: ResourceTab;
  /** Ce que chaque rubrique contient, quand on le sait : le nombre de
   *  documents et le nombre de contacts. */
  counts?: Partial<Record<ResourceTab, number | null>>;
};

/** Chaque rubrique : son nom, son dessin, ce qu'elle compte (`noun`) et ce
 *  qu'elle range, dit tant que le nombre n'est pas connu (`idle`). */
const RESOURCE_TABS: ReadonlyArray<{ key: ResourceTab; title: string; noun: string; idle: string; icon: ReactNode }> = [
  {
    key: "forms", title: "Formulaires", noun: "document", idle: "Dossiers",
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 13h6M9 17h6" /></svg>,
  },
  {
    key: "contacts", title: "Contacts", noun: "contact", idle: "Annuaires",
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10.5" r="2.2" /><path d="M5.6 16.5c.7-1.9 1.9-2.8 3.4-2.8s2.7.9 3.4 2.8M15.5 9.5h3M15.5 13h3" /></svg>,
  },
];

/** Ce qu'une tuile annonce sous son nom : « 11 documents », « 1 contact »,
 *  « Aucun document » ; « Dossiers » ou « Annuaires » tant que le nombre n'est
 *  pas connu. */
export function resourceTabDetail(count: number | null | undefined, noun: string, idle: string) {
  if (count === null || count === undefined) return idle;
  return count ? `${count} ${noun}${count > 1 ? "s" : ""}` : `Aucun ${noun}`;
}

/** Documents et contacts : les formulaires s'affichent d'emblée, Contacts à
 *  côté, chacun dans une tuile qui dit ce qu'elle contient. Plus d'écran
 *  d'entrée à traverser. */
export function UsefulResourcesHub({ forms, contacts, initialTab = "forms", counts }: UsefulResourcesHubProps) {
  const [activeTab, setActiveTab] = useState<ResourceTab>(initialTab);
  const selectTab = (tab: ResourceTab) => {
    setActiveTab(tab);
    // Un onglet choisi à la main n'est plus « ouvert depuis Titres repas ».
    window.history.pushState({ ...window.history.state, resourceTab: tab, returnTo: undefined }, "");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  // Le bouton Retour du téléphone revient à l'onglet précédent.
  useEffect(() => {
    const restoreTab = () => setActiveTab(window.history.state?.resourceTab ?? "forms");
    window.addEventListener("popstate", restoreTab);
    return () => window.removeEventListener("popstate", restoreTab);
  }, []);
  // La fenêtre d'aide ouvre le bon onglet ; une sous-page (codes radio,
  // accident) est ensuite servie par l'onglet lui-même.
  useHelpTarget((target) => {
    const tab: ResourceTab | null = target === "contacts" || target === "radio-codes" || target === "meal-contact" ? "contacts"
      : target === "forms" || target === "work-accident" || target === "expo-folder" || target === "meal-folder" || target === "meal-forms" ? "forms" : null;
    if (!tab) return false;
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "auto" });
    return target === "contacts" || target === "forms";
  });

  return (
    <section className="useful-resources-screen has-active-resource" aria-label="Documents et contacts">
      <div className="useful-resource-tabs" role="tablist" aria-label="Documents et contacts">
        {RESOURCE_TABS.map((tab) => {
          const detail = resourceTabDetail(counts?.[tab.key], tab.noun, tab.idle);
          return (
            <button
              key={tab.key}
              className={`useful-resource-tab resource-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`useful-resource-panel-${tab.key}`}
              aria-label={`${tab.title}, ${detail}`}
              onClick={() => selectTab(tab.key)}
            >
              <span className="useful-resource-tab-mark" aria-hidden="true">{tab.icon}</span>
              <span className="useful-resource-tab-copy"><strong>{tab.title}</strong><small>{detail}</small></span>
            </button>
          );
        })}
      </div>
      <div
        className="useful-resource-panel"
        id={`useful-resource-panel-${activeTab}`}
        role="tabpanel"
        aria-label={activeTab === "forms" ? "Formulaires" : "Contacts"}
      >
        {activeTab === "forms" ? forms : contacts}
      </div>
    </section>
  );
}
