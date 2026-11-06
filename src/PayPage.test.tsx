import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayPage, type PayScreen } from "./PayPage";

function renderPage(screen: PayScreen, props: { netEstimateComplete?: boolean; profileOpen?: boolean; settingsOpen?: boolean } = {}) {
  return renderToStaticMarkup(
    <PayPage
      screen={screen}
      month={10}
      year={2026}
      profileOpen={false}
      profileFocusRequested={false}
      settingsOpen={false}
      netEstimateComplete
      gross={2_600}
      grossComplete
      net={2_080}
      reliability={{ tone: "estimated", label: "Estimation", detail: "Profil annuel" }}
      variables={[]}
      deductionContent={null}
      monthSlide=""
      allowancesContent={<p>Contenu des primes</p>}
      estimateContent={<p>Contenu du calcul</p>}
      yearContent={<p>Contenu de l’année</p>}
      mealContent={<p>Contenu des titres repas</p>}
      verificationContent={null}
      settingsContent={null}
      onScreenChange={vi.fn()}
      onToggleProfile={vi.fn()}
      onProfileFocused={vi.fn()}
      onToggleSettings={vi.fn()}
      onWorkQuotaChange={vi.fn()}
      onWorkScheduleChange={vi.fn()}
      onStatusChange={vi.fn()}
      onSaveProfile={vi.fn()}
      onPreviousMonth={vi.fn()}
      onNextMonth={vi.fn()}
      onToday={vi.fn()}
      onTouchStart={vi.fn()}
      onTouchEnd={vi.fn()}
      {...props}
    />,
  );
}

describe("PayPage", () => {
  it.each<[PayScreen, string, string, string]>([
    ["allowances", "Primes et jours fériés", "novembre 2026", "Contenu des primes"],
    ["payslip", "Détail du calcul", "novembre 2026", "Contenu du calcul"],
    ["year", "L’année en un coup d’œil", "Net, primes, mécénats, impôt", "Contenu de l’année"],
    ["meal", "Titres repas", "Valeur du titre, nombre par mois", "Contenu des titres repas"],
  ])("sous-écran %s : son titre, son repère et son contenu", (screen, title, detail, content) => {
    const html = renderPage(screen);
    expect(html).toContain(`<h2>${title}</h2>`);
    expect(html).toContain(`<small>${detail}</small>`);
    expect(html).toContain(content);
    expect(html).not.toContain("pay-dashboard-motion");
  });

  it("referme un sous-écran par sa flèche ou toute sa zone de titre, sans croix en plus", () => {
    const html = renderPage("meal");
    expect(html).toContain('class="pay-detail-sticky-header"');
    expect(html).toContain('aria-label="Revenir au tableau de bord de paie"');
    expect(html).toMatch(/class="pay-detail-title-button"[^>]*aria-label="Fermer cette page et revenir à Ma paie"/);
    expect(html).not.toContain('aria-label="Fermer cette page"');
    expect(html).not.toContain("pay-detail-close");
  });

  it("dit l’état du profil replié, et plus rien une fois ouvert : la flèche suffit", () => {
    const complete = renderPage("overview", { settingsOpen: true });
    expect(complete).toContain('<span class="pay-profile-open-copy complete">Profil complet</span>');
    const missing = renderPage("overview", { settingsOpen: true, netEstimateComplete: false });
    expect(missing).toContain('<span class="pay-profile-open-copy missing">À compléter</span>');
    const open = renderPage("overview", { profileOpen: true });
    expect(open).not.toContain("pay-profile-open-copy");
    expect(open).not.toContain("Replier");
  });
});
