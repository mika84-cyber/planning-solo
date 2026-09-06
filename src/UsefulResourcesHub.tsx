import { useEffect, useState, type ReactNode } from "react";

type ResourceTab = "pdf" | "forms" | "contacts";

type UsefulResourcesHubProps = {
  forms: ReactNode;
  contacts: ReactNode;
  pdf: ReactNode;
  initialTab?: ResourceTab;
};

const RESOURCE_TABS: ReadonlyArray<{
  key: ResourceTab;
  title: string;
  image: string;
}> = [
  { key: "pdf", title: "Plannings PDF", image: "/resource-pdf-brancusi-v3.png" },
  {
    key: "forms",
    title: "Formulaires",
    image: "/resource-forms-brancusi.png",
  },
  {
    key: "contacts",
    title: "Contacts",
    image: "/resource-contacts-brancusi-v3.png",
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
              <img src={tab.image} alt="" draggable={false} decoding="async" />
            </span>
            <span className="useful-resource-tab-copy">
              <strong>{tab.title}</strong>
              {activeTab ? <small>{activeTab === tab.key ? "Ouvert" : "Ouvrir"}</small> : null}
            </span>
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
