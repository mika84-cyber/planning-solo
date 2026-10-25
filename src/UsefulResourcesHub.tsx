import { useEffect, useState, type ReactNode } from "react";
import { useHelpTarget } from "./helpTargets";

type ResourceTab = "forms" | "contacts";

type UsefulResourcesHubProps = {
  forms: ReactNode;
  contacts: ReactNode;
  initialTab?: ResourceTab;
};

const RESOURCE_TABS: ReadonlyArray<{ key: ResourceTab; title: string }> = [
  { key: "forms", title: "Formulaires" },
  { key: "contacts", title: "Contacts" },
];

/** Documents et contacts : les formulaires s'affichent d'emblée, Contacts à
 *  côté dans un sélecteur segmenté. Plus d'écran d'entrée à traverser. */
export function UsefulResourcesHub({ forms, contacts, initialTab = "forms" }: UsefulResourcesHubProps) {
  const [activeTab, setActiveTab] = useState<ResourceTab>(initialTab);
  const selectTab = (tab: ResourceTab) => {
    setActiveTab(tab);
    window.history.pushState({ ...window.history.state, resourceTab: tab }, "");
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
    const tab: ResourceTab | null = target === "contacts" || target === "radio-codes" ? "contacts"
      : target === "forms" || target === "work-accident" || target === "expo-folder" ? "forms" : null;
    if (!tab) return false;
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "auto" });
    return target === "contacts" || target === "forms";
  });

  return (
    <section className="useful-resources-screen has-active-resource" aria-label="Documents et contacts">
      <div className="useful-resource-tabs" role="tablist" aria-label="Documents et contacts">
        {RESOURCE_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`useful-resource-tab resource-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`useful-resource-panel-${tab.key}`}
            aria-label={tab.title}
            onClick={() => selectTab(tab.key)}
          >
            <span className="useful-resource-tab-copy"><strong>{tab.title}</strong></span>
          </button>
        ))}
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
