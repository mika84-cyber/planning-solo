import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CetSection } from "./CetSection";
import { emptyCetAccount } from "./cet";

describe("CetSection", () => {
  it("présente une configuration prudente quand aucun CET n'est renseigné", () => {
    const html = renderToStaticMarkup(
      <CetSection status="contractuel" fullName="" signature="" annualDaysTaken={20} plannedLeaveDays={0} remaining={{ annual: 9, rtt: 4, fraction: 2 }} saving={false} onSave={vi.fn()} onRequestLeave={vi.fn()} />,
    );
    expect(html).toContain("Mon CET");
    expect(html).toContain("Configurez votre compte à partir de votre relevé RH");
    expect(html).toContain("Indiquez simplement le solde qui y figure");
    expect(html).not.toContain("Votre relevé RH reste la référence");
    expect(html).not.toContain("cet-declined");
  });

  it("propose, après « Je n'ai pas de CET », de demander l'ouverture ou d'indiquer son solde", () => {
    const html = renderToStaticMarkup(
      <CetSection account={{ ...emptyCetAccount(), enabled: false }} status="contractuel" fullName="" signature="" annualDaysTaken={20} plannedLeaveDays={0} remaining={{ annual: 9, rtt: 4, fraction: 2 }} saving={false} onSave={vi.fn()} onRequestLeave={vi.fn()} />,
    );
    expect(html).toContain("<small>Vous avez répondu « Je n’ai pas de CET »</small>");
    expect(html).toContain('<div class="cet-settings"><p class="cet-declined">Pour ouvrir un CET, faites la demande d’ouverture ci-dessous. Si vous en avez déjà un, indiquez le solde de votre relevé RH : l’accueil vous dira ce que vous pouvez y verser.</p><div class="cet-callout">');
    expect(html).toContain(">Faire une demande d’ouverture</button>");
    expect(html).toContain(">Mes droits sont déjà ouverts</button>");
  });

  it("affiche le solde suivi sans le présenter comme un solde officiel", () => {
    const account = emptyCetAccount();
    account.initialBalance = 18;
    account.employerName = "Centre Pompidou";
    const html = renderToStaticMarkup(
      <CetSection account={account} status="fonctionnaire" fullName="Agnès Martin" signature="" annualDaysTaken={21} plannedLeaveDays={0} remaining={{ annual: 8, rtt: 3, fraction: 1 }} saving={false} onSave={vi.fn()} onRequestLeave={vi.fn()} />,
    );
    expect(html).toContain("Solde suivi : 18 jours");
  });

  // Ancien contrôle textuel d'uiRefinement.test.mjs, devenu test de rendu.
  it("s'affiche en rubrique ouverte, rappelle la période d'alimentation et laisse le solde vide à saisir", () => {
    const blank = renderToStaticMarkup(
      <CetSection status="contractuel" fullName="" signature="" annualDaysTaken={20} plannedLeaveDays={0} remaining={{ annual: 9, rtt: 4, fraction: 2 }} saving={false} onSave={vi.fn()} onRequestLeave={vi.fn()} />,
    );
    expect(blank).toContain('<section class="cet-section open cet-section-static" aria-labelledby="cet-title">');
    // Rien à déplier : la rubrique est toujours ouverte.
    expect(blank).not.toContain("aria-expanded");
    expect(blank).not.toContain("Planning Solo vous aide à suivre et simuler votre CET");
    // Le solde part vide, avec « 0 » en indication, pour qu'on puisse l'effacer et le retaper.
    expect(blank).toContain('<input type="number" min="0" max="200" step="1" placeholder="0" value=""/>');

    const account = emptyCetAccount();
    account.initialBalance = 18;
    const tracked = renderToStaticMarkup(
      <CetSection account={account} status="contractuel" fullName="" signature="" annualDaysTaken={20} plannedLeaveDays={0} remaining={{ annual: 9, rtt: 4, fraction: 2 }} saving={false} onSave={vi.fn()} onRequestLeave={vi.fn()} />,
    );
    expect(tracked).toContain("Solde suivi : 18 jours · alimentation du 15 novembre au 31 décembre");
  });

  it("dit où envoyer les formulaires : l'adresse de la DRH-CET, en lien", () => {
    const account = emptyCetAccount();
    account.initialBalance = 18;
    const html = renderToStaticMarkup(
      <CetSection account={account} status="contractuel" fullName="" signature="" annualDaysTaken={20} plannedLeaveDays={0} remaining={{ annual: 9, rtt: 4, fraction: 2 }} saving={false} onSave={vi.fn()} onRequestLeave={vi.fn()} />,
    );
    // Phrase demandée par l'administrateur, le 21 novembre 2026 : l'adresse
    // seule, sans « la DRH-CET » ni parenthèses.
    expect(html).toContain('<p class="cet-form-note">Les formulaires reprennent exactement les modèles fournis. Après téléchargement, envoyez-les à <a href="mailto:DRH-CET@centrepompidou.fr">DRH-CET@centrepompidou.fr</a>. Pour utiliser des jours CET, le bouton ci-dessus ouvre le formulaire de congé classique.</p>');
  });
});
