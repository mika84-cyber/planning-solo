import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeDashboard } from "./HomeDashboard";

const baseProps = {
  now: new Date(2026, 8, 3),
  group: 2,
  hasConfiguredGroup: false,
  today: { tone: "work", status: "Travail", nextWork: new Date(2026, 8, 4) },
  totalLeaveRemaining: 20,
  nextExtraWork: { kind: "mecenat" as const, date: "2026-09-12", start: "19:00", end: "23:00" },
  importantAlert: "",
  setupItems: [{
    id: "planning-group",
    title: "Groupe de planning",
    detail: "Vos jours de travail et de repos",
    done: false,
    onAction: vi.fn(),
    action: "Choisir" as string | undefined,
  }, {
    id: "pay-profile",
    title: "Profil de calcul",
    detail: "Statut et quotité renseignés",
    done: true,
    onAction: vi.fn(),
  }],
  setupDismissKey: "planning:test-setup-dismissed",
  hasAnyNote: false,
  noteQuery: "",
  onNoteQueryChange: vi.fn(),
  noteSearchResults: [],
  upcoming: [],
  renderNoteItems: () => null,
  onChooseGroup: vi.fn(),
  onOpenNextWork: vi.fn(),
  onOpenLeave: vi.fn(),
  onOpenPayAlert: vi.fn(),
  onAddNote: vi.fn(),
};

describe("HomeDashboard", () => {
  it("donne les congés restants de l’année choisie dans le calendrier", () => {
    const current = renderToStaticMarkup(<HomeDashboard {...baseProps} />);
    expect(current).toContain('aria-label="Congés restants : 20 jours. Afficher le détail des soldes."');
    expect(current).toContain('<small class="today-block-note">à poser</small>');
    const next = renderToStaticMarkup(<HomeDashboard {...baseProps} totalLeaveRemaining={33} leaveYear={2027} />);
    expect(next).toContain('aria-label="Congés restants en 2027 : 33 jours. Afficher le détail des soldes."');
    expect(next).toContain("<strong>33 jours</strong>");
    expect(next).toContain('<small class="today-block-note">en 2027</small>');
  });

  // Ancien contrôle textuel d'uiRefinement.test.mjs, devenu test de rendu.
  it("place le choix du groupe dans l’en-tête d’Aujourd’hui, sans carte à part", () => {
    const heading = (html: string) => html.slice(html.indexOf('<div class="today-overview-heading">'), html.indexOf('<div class="today-blocks">'));
    const chosen = renderToStaticMarkup(<HomeDashboard {...baseProps} hasConfiguredGroup />);
    expect(heading(chosen)).toContain('<button class="primary-action add-action group-heading-action" type="button" aria-label="Je suis groupe 2. Modifier mon groupe">Je suis groupe 2</button>');
    expect(chosen).not.toContain("today-group-card");
    const unset = renderToStaticMarkup(<HomeDashboard {...baseProps} />);
    expect(heading(unset)).toContain('aria-label="Choisir mon groupe">Choisir mon groupe</button>');
  });

  // Ancien contrôle textuel d'uiRefinement.test.mjs, devenu test de rendu.
  it("présente les repères du jour en blocs, la journée en tête et le prochain férié travaillé", () => {
    const labels = (html: string) => [...html.matchAll(/class="today-block-label">([^<]*)</g)].map((match) => match[1]);
    const today = { ...baseProps.today, nextWorkedHoliday: { date: new Date(2026, 10, 11), name: "Armistice" } };
    const html = renderToStaticMarkup(<HomeDashboard {...baseProps} today={today} />);
    expect(labels(html)).toEqual(["Aujourd’hui", "Prochain jour travaillé", "Congés restants", "Prochain férié travaillé", "Prochain mécénat"]);
    // La journée a le format des autres lignes : sa couleur tient à sa classe.
    expect(html).toContain('<article class="today-block today-status tone-work"><span class="today-block-icon" aria-hidden="true">');
    expect(html).toContain('<span class="today-block-label">Prochain férié travaillé</span><strong class="is-date">');
    expect(html).toContain('<small class="today-block-note">Armistice</small>');
    // Pas de férié travaillé à venir : pas de ligne vide. Ni grille ni éphéméride.
    const none = renderToStaticMarkup(<HomeDashboard {...baseProps} />);
    expect(labels(none)).not.toContain("Prochain férié travaillé");
    expect(none).not.toMatch(/today-overview-grid|ephemeris/);
  });

  it("ne répète pas sur l’accueil les actions déjà accessibles dans la navigation", () => {
    const html = renderToStaticMarkup(<HomeDashboard {...baseProps} />);
    expect(html).not.toContain("Accès rapide");
    expect(html).not.toContain("Trouver un document");
  });

  it("montre toutes les étapes dans la frise et met en avant celle à faire", () => {
    const html = renderToStaticMarkup(<HomeDashboard {...baseProps} />);
    expect(html).toContain("Pour bien démarrer");
    expect(html).toContain('<h2 id="home-setup-title">Mise en route</h2>');
    // L'anneau : les étapes réglées sur le total.
    expect(html).toContain('role="progressbar" aria-label="Étapes terminées" aria-valuemin="0" aria-valuemax="2" aria-valuenow="1" aria-valuetext="1 sur 2" style="--done:50%"><b>1</b><small>sur 2</small>');
    // La frise : l'étape faite est cochée, celle à faire se touche.
    expect(html).toContain('<li class="done"><span class="home-setup-mark" aria-hidden="true"><svg');
    expect(html).toContain("Profil de calcul : Statut et quotité renseignés · Fait");
    expect(html).toContain('<li class="current"><button class="home-setup-step" type="button" aria-label="Groupe de planning : Vos jours de travail et de repos" aria-current="step">');
    // La carte de l'étape à faire, son bouton, et de quoi l'écarter.
    expect(html).toContain('<span class="home-setup-kicker">Étape 1 · à faire</span><strong>Groupe de planning</strong><small>Vos jours de travail et de repos</small>');
    expect(html).toContain('aria-label="Choisir : Groupe de planning">Choisir<svg');
    expect(html).toContain('aria-label="Ne pas remplir : Groupe de planning">Pas maintenant</button>');
    // Le conseil sur les congés n'est pas une étape à cocher.
    expect(html).toContain("prime des dimanches et le détail de vos soldes");
  });

  it("donne à chaque étape son nom court dans la frise, ou son titre à défaut", () => {
    const items = baseProps.setupItems.map((item, index) => ({ ...item, short: index ? "Profil" : undefined }));
    const html = renderToStaticMarkup(<HomeDashboard {...baseProps} setupItems={items} />);
    expect(html).toContain('<small aria-hidden="true">Groupe de planning</small>');
    expect(html).toContain('<small aria-hidden="true">Profil</small>');
    // Sans verbe, le bouton propose de commencer.
    const plain = renderToStaticMarkup(<HomeDashboard {...baseProps} setupItems={baseProps.setupItems.map(({ action: _, ...item }) => item)} />);
    expect(plain).toContain('aria-label="Commencer : Groupe de planning">Commencer<svg');
  });

  it("retire la liste lorsque tout est fait", () => {
    const html = renderToStaticMarkup(<HomeDashboard {...baseProps} setupItems={baseProps.setupItems.map((item) => ({ ...item, done: true }))} />);
    expect(html).not.toContain("Pour bien démarrer");
  });

  it("précise une demi-journée sur le prochain jour travaillé", () => {
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      today={{ ...baseProps.today, nextWorkHalfLeaveLabel: "1/2 journée posée le matin" }}
    />);
    expect(html).toContain('Ven 04/09<span class="today-value-detail">1/2 journée posée le matin</span>');
  });

  it("précise le poste du prochain jour travaillé", () => {
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      today={{ ...baseProps.today, nextWorkPostLabel: "Accueil", nextWorkHalfLeaveLabel: "1/2 journée posée le matin" }}
    />);
    expect(html).toContain('Ven 04/09<span class="today-value-detail">Accueil · 1/2 journée posée le matin</span>');
  });

  it("précise une demi-journée posée l’après-midi", () => {
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      today={{ ...baseProps.today, nextWork: new Date(2026, 8, 6, 12), nextWorkHalfLeaveLabel: "1/2 journée posée l’après-midi" }}
    />);
    expect(html).toContain('Dim 06/09<span class="today-value-detail">1/2 journée posée l’après-midi</span>');
  });

  it("conserve le groupe dans Aujourd’hui quand une demi-journée reste travaillée", () => {
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      today={{ ...baseProps.today, status: "1/2 journée posée l’après-midi", todayGroupLabel: "Avec le groupe 3" }}
    />);
    expect(html).toContain("Avec le groupe 3");
  });

  // Ancien contrôle textuel d'uiRefinement.test.mjs, devenu test de rendu.
  it("annonce le prochain mécénat ou les prochaines heures sup à la place du travail restant", () => {
    const html = renderToStaticMarkup(<HomeDashboard {...baseProps} />);
    expect(html).toContain('<button class="today-block today-next-extra" type="button" aria-label="Prochain mécénat : Sam 12/09, 19 h – 23 h. Afficher les heures et mécénats.">');
    expect(html).not.toContain("today-remaining-work");
    expect(html).toContain("Prochain mécénat");
    expect(html).toContain("19 h – 23 h");
    expect(html).not.toContain("Travail restant");
    // Rien de prévu : la ligne disparaît.
    const empty = renderToStaticMarkup(<HomeDashboard {...baseProps} nextExtraWork={null} />);
    expect(empty).not.toContain("today-next-extra");
    expect(empty).not.toContain("Prochain mécénat");
    const overtime = renderToStaticMarkup(<HomeDashboard {...baseProps} nextExtraWork={{ kind: "overtime", date: "2026-09-05", start: "18:00", end: "20:30" }} />);
    expect(overtime).toContain("Prochaine heure sup");
    expect(overtime).toContain("18 h – 20 h 30");
  });

  it("annonce la prochaine note quand il y en a une", () => {
    const none = renderToStaticMarkup(<HomeDashboard {...baseProps} />);
    expect(none).not.toContain("Prochaine note");
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      upcoming={[
        { key: "leave-1", date: "2026-09-04", label: "CA", detail: "", kind: "leave" },
        { key: "note-1", date: "2026-09-10", label: "Réunion d’équipe", detail: "", kind: "note", author: "mika", notes: [{ author: "mika", label: "Réunion d’équipe" }] },
      ]}
    />);
    expect(html).toContain("Prochaine note");
    expect(html).toContain("Jeu 10/09");
    expect(html).toContain("Réunion d’équipe");
    // Même loin — le mois suivant —, la prochaine note se lit.
    const later = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      upcoming={[{ key: "note-2", date: "2026-10-14", label: "Plus tard", detail: "", kind: "note", author: "mika" }]}
    />);
    expect(later).toContain("Prochaine note");
    expect(later).toContain("Plus tard");
    // Une seule note : pas de compteur.
    expect(html).not.toContain("today-note-more");
    expect(html).not.toContain("(voir)");
  });

  it("montre la première note du jour et compte les autres, avec « (voir) »", () => {
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      upcoming={[{
        key: "notes-2026-11-09",
        date: "2026-11-09",
        label: "– Psy 11h45\n– Mécénat 19h30 / minuit",
        detail: "",
        kind: "note",
        author: "mika",
        notes: [
          { author: "mika", label: "– Psy 11h45\n– Mécénat 19h30 / minuit" },
          { author: "agnes", label: "Courses" },
        ],
      }]}
    />);
    expect(html).toContain('<span class="today-note-first">Psy 11h45</span>');
    expect(html).toContain('<span class="today-note-more">+2 <span>(voir)</span></span>');
    expect(html).not.toContain("Mécénat 19h30 / minuit</span>");
    // Le lecteur d’écran entend toutes les notes du jour.
    expect(html).toContain('aria-label="Prochaines notes : Lun 09/11, Psy 11h45, Mécénat 19h30 / minuit, Courses. Afficher ce jour."');
  });
});
