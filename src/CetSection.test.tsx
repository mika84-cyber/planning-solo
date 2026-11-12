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
});
