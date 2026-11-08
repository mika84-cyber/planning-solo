import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { HomeSectionScreen } from "./HomeSectionScreen";

const noop = vi.fn();

const baseProps: ComponentProps<typeof HomeSectionScreen> = {
  now: new Date(2026, 8, 3),
  group: 2,
  demoMode: false,
  userEmail: "mika@example.org",
  isProgramAdmin: false,
  formProfile: null,
  entries: {},
  ownNoteAuthorLabel: "Mika",
  overview: {
    todayOverview: {
      tone: "work", status: "Travail", todayGroupLabel: "groupe 2", nextWork: new Date(2026, 8, 4), nextWorkKind: null,
      nextWorkExceptionalClosure: false, nextWorkGroupLabel: "", nextWorkHalfLeaveLabel: "", nextWorkPostLabel: "", nextWorkedHoliday: null,
    },
    nextExtraWork: { kind: "mecenat", date: "2026-09-12", start: "19:00", end: "23:00" },
    totalLeaveRemaining: 20,
    upcoming: [],
    hasAnyNote: false,
    noteSearchResults: [],
  },
  setup: { missingCalculationProfile: true, missingHolidayChoices: 3, missingPayValues: true },
  shell: { noteQuery: "", setNoteQuery: noop, setHomeSection: noop, setGroupChooserOpen: noop },
  pay: {
    setPayScreen: noop,
    setPayProfileOpen: noop,
    setPayAdvancedOpen: noop,
    setPayProfileFocusRequested: noop,
    setPayVerificationRequested: noop,
  },
  actions: { setView: noop, openDay: noop, beginQuickNote: noop, deleteMultiplePlanningDates: noop, deleteAgnesNote: noop },
};

/** Le tableau d’accueil est chargé à part : le premier rendu lance son
 *  chargement et montre l’attente, le second rend le tableau. */
async function renderSettled(element: ReactElement) {
  renderToStaticMarkup(element);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const html = renderToStaticMarkup(element);
  expect(html).not.toContain("Chargement de votre accueil");
  return html;
}

describe("HomeSectionScreen", () => {
  beforeAll(async () => {
    await import("./HomeDashboard");
  });

  it("liste les premières étapes avec ce qui reste à renseigner", async () => {
    const html = await renderSettled(<HomeSectionScreen {...baseProps} />);
    expect(html).toContain("Groupe de planning");
    expect(html).toContain("Jours de travail et de repos");
    expect(html).toContain("Statut et quotité");
    expect(html).toContain("3 à choisir");
    expect(html).toContain("Lu tout seul");
    expect(html).toContain("Jours fériés 2026");
  });

  it("compte les étapes déjà faites et retire la mise en route une fois tout renseigné", async () => {
    const formProfile = { group: 2 } as unknown as NonNullable<typeof baseProps.formProfile>;
    const partial = await renderSettled(
      <HomeSectionScreen
        {...baseProps}
        formProfile={formProfile}
        setup={{ missingCalculationProfile: false, missingHolidayChoices: 3, missingPayValues: true }}
      />,
    );
    expect(partial).toContain("Mise en route : 2 sur 4");
    expect(partial).toContain("Groupe 2");
    expect(partial).toContain("Statut et quotité renseignés");
    const complete = await renderSettled(
      <HomeSectionScreen
        {...baseProps}
        formProfile={formProfile}
        setup={{ missingCalculationProfile: false, missingHolidayChoices: 0, missingPayValues: false }}
      />,
    );
    expect(complete).not.toContain("Mise en route");
    expect(complete).toContain("Je suis groupe 2");
  });

  it("rend les notes à venir avec l’auteur des notes personnelles", async () => {
    const html = await renderSettled(
      <HomeSectionScreen
        {...baseProps}
        overview={{
          ...baseProps.overview,
          hasAnyNote: true,
          upcoming: [{ key: "2026-09-10", date: "2026-09-10", label: "Réunion d’équipe", detail: "Jeudi 10 septembre", kind: "note" }],
        }}
      />,
    );
    expect(html).toContain("Réunion d’équipe");
  });
});
