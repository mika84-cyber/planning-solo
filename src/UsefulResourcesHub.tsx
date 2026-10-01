import { useEffect, useState, type ReactNode } from "react";

type ResourceTab = "pdf" | "forms" | "contacts";

type UsefulResourcesHubProps = {
  forms: ReactNode;
  contacts: ReactNode;
  pdf: ReactNode;
  initialTab?: ResourceTab;
};

/** Chaque rubrique dit en une ligne ce qu'on y trouve, sous une icône au
 *  trait posée sur un fond teinté. */
const RESOURCE_TABS: ReadonlyArray<{
  key: ResourceTab;
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    key: "pdf",
    title: "Plannings PDF",
    description: "Planning annuel, les 3 groupes, vos congés, fériés travaillés",
    icon: <svg viewBox="0 0 48 48"><path d="M14 6h14l8 8v28H14z" /><path d="M28 6v8h8" /><path d="M19 24h12M19 30h12M19 36h7" /></svg>,
  },
  {
    key: "forms",
    title: "Formulaires",
    description: "Expo, SAP, Brantôme et accident de travail",
    icon: <svg viewBox="0 0 48 48"><path d="M6 14h13l4 4h19v22H6z" /><path d="M6 22h36" /><path d="M15 9h12" /></svg>,
  },
  {
    key: "contacts",
    title: "Contacts",
    description: "Numéros utiles et services du musée",
    icon: <svg viewBox="0 0 48 48"><path d="M14 8h7l3 9-4.5 3a22 22 0 0 0 9.5 9.5l3-4.5 9 3v7a3 3 0 0 1-3 3C21 38 10 27 10 11a3 3 0 0 1 4-3z" /></svg>,
  },
];

export function UsefulResourcesHub({ forms, contacts, pdf, initialTab }: UsefulResourcesHubProps) {
  const [activeTab, setActiveTab] = useState<ResourceTab | null>(initialTab ?? null);
  const selectTab = (tab: ResourceTab) => {
    setActiveTab(tab);
    window.history.pushState({ ...window.history.state, resourceTab: tab }, "");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const returnToResources = () => {
    setActiveTab(null);
    const { resourceTab: _resourceTab, ...historyState } = window.history.state ?? {};
    window.history.replaceState(historyState, "");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  useEffect(() => {
    const closeTab = () => setActiveTab((current) => window.history.state?.resourceTab ?? (current ? null : current));
    window.addEventListener("popstate", closeTab);
    return () => window.removeEventListener("popstate", closeTab);
  }, []);

  return (
    <section
      className={`useful-resources-screen${activeTab ? " has-active-resource" : ""}`}
      aria-labelledby="useful-resources-title"
    >
      <div className="useful-resource-intro">
        <h2 id="useful-resources-title">Choisir une rubrique</h2>
        <p>Retrouvez rapidement vos documents et vos contacts utiles.</p>
      </div>

      {activeTab ? (
        <button className="useful-resource-back" type="button" onClick={returnToResources}>
          <span aria-hidden="true">←</span>
          Toutes les rubriques
        </button>
      ) : null}

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
            <span className="useful-resource-tab-art" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="useful-resource-tab-copy">
              <strong>{tab.title}</strong>
              <small>{tab.description}</small>
            </span>
            <span className="useful-resource-tab-go" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      {activeTab ? (
        <div
          className="useful-resource-panel"
          id={`useful-resource-panel-${activeTab}`}
          role="tabpanel"
          aria-label={activeTab === "pdf" ? "Plannings PDF" : activeTab === "forms" ? "Formulaires" : "Contacts"}
        >
          {activeTab === "pdf" ? pdf : activeTab === "forms" ? forms : contacts}
        </div>
      ) : null}
    </section>
  );
}
