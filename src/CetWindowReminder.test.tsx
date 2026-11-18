import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyCetAccount } from "./cet";
import { CetWindowReminder, cetReminderFolded, cetTickerParts, cetWindowElapsed, cetWindowReminderState } from "./CetWindowReminder";

const remaining = { annual: 9, rtt: 15, fraction: 2 };
const tracked = () => ({ ...emptyCetAccount(), initialBalance: 5 });
const state = (todayKey: string, account = tracked(), annualDaysTaken = 20) =>
  cetWindowReminderState({ todayKey, account, annualDaysTaken, remaining, plannedLeaveDays: 0 });
const used = (annualUsed: number) => ({ "2026": { annualUsed, rttUsed: 0, fractionUsed: 0, sundayLeaveJanJun: 0, sundayLeaveJulSep: 0, sundayLeaveOctNov: 0, sundayLeaveDec: 0 } });
const handlers = { onPrepare: vi.fn(), onOpenCet: vi.fn(), onRequestOpening: vi.fn(), onRequestLeave: vi.fn(), onSaveBalance: vi.fn(async () => true), onNoCet: vi.fn() };
const render = (todayKey: string, account: ReturnType<typeof tracked> | undefined, annualUsed = 20) => renderToStaticMarkup(
  <CetWindowReminder todayKey={todayKey} account={account} periods={[]} group={2} manualAdjustments={used(annualUsed)} {...handlers} />,
);

describe("le rappel de l'alimentation du CET sur l'accueil", () => {
  it("ne s'affiche que du 15 novembre au 31 décembre, et compte les jours à partir du 24", () => {
    expect(state("2026-11-14")).toBeNull();
    expect(state("2027-01-01")).toBeNull();
    expect(state("2026-11-15")).toMatchObject({ kind: "open", total: 20 });
    expect(state("2026-12-24")?.daysLeft).toBe(8);
    expect(state("2026-12-31")?.daysLeft).toBe(1);
  });

  it("se tait une fois l'alimentation enregistrée ou sans rien à verser", () => {
    const deposited = tracked();
    deposited.operations = [{ id: "1", date: "2026-11-18", kind: "deposit", days: 4, source: "rtt" }];
    expect(state("2026-11-20", deposited)).toBeNull();
    // L'alimentation de l'an dernier n'empêche pas celle de cette année.
    deposited.operations[0].date = "2025-12-10";
    expect(state("2026-11-20", deposited)).toMatchObject({ kind: "open" });
    expect(cetWindowReminderState({ todayKey: "2026-11-20", account: tracked(), annualDaysTaken: 20, remaining: { annual: 0, rtt: 0, fraction: 0 }, plannedLeaveDays: 0 })).toBeNull();
  });

  it("pose la question à qui n'a pas de CET, jusqu'à « Non », qui la fait taire pour l'année", () => {
    const none = { ...tracked(), enabled: false };
    const ask = (todayKey: string, account: typeof none | undefined, declinedYear?: number) =>
      cetWindowReminderState({ todayKey, account, annualDaysTaken: 0, remaining, plannedLeaveDays: 0, declinedYear });
    // « Je n'ai pas de CET » ne coupe plus le rappel pour de bon : la question
    // revient, pour demander l'ouverture ou indiquer un solde.
    expect(ask("2026-11-20", none)).toMatchObject({ kind: "setup" });
    expect(ask("2026-11-20", undefined)).toMatchObject({ kind: "setup" });
    // « Non » répondu cette année : silence jusqu'à la période suivante.
    expect(ask("2026-11-20", none, 2026)).toBeNull();
    expect(ask("2026-12-31", undefined, 2026)).toBeNull();
    expect(ask("2027-11-20", none, 2026)).toMatchObject({ kind: "setup" });
    // Un CET suivi n'est pas concerné par ce « Non ».
    expect(cetWindowReminderState({ todayKey: "2026-11-20", account: tracked(), annualDaysTaken: 20, remaining, plannedLeaveDays: 0, declinedYear: 2026 })).toMatchObject({ kind: "open" });
  });

  it("demande le solde d'un CET non renseigné, ou dit les CA qui manquent", () => {
    expect(cetWindowReminderState({ todayKey: "2026-11-20", account: undefined, annualDaysTaken: 0, remaining, plannedLeaveDays: 0 })).toMatchObject({ kind: "setup" });
    expect(state("2026-11-20", tracked(), 15.5)).toMatchObject({ kind: "missing", missingDays: 2.5, minimum: 18, taken: 15.5 });
  });

  it("guide en trois étapes : la frise, puis ce qui peut être versé et le formulaire d'alimentation", () => {
    const html = render("2026-11-20", tracked());
    expect(html).toContain('<aside class="cet-window-reminder open" aria-labelledby="cet-window-reminder-title"><div class="cet-window-reminder-top"><span class="step-label">CET · jusqu’au 31 décembre</span><button type="button" class="cet-window-reminder-later">Plus tard</button></div>');
    // La frise : le CET et son solde sont faits, la demande est l'étape en cours.
    expect(html).toContain('<ol class="cet-journey" aria-label="Étapes"><li class="done"><span class="cet-journey-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg></span><small>Votre CET<span class="visually-hidden"> : fait</span></small></li>');
    expect(html).toContain('<li class="current" aria-current="step"><span class="cet-journey-mark" aria-hidden="true">3</span><small>Demande</small></li></ol>');
    expect(html).toContain('<h2 id="cet-window-reminder-title">Vous pouvez verser jusqu’à 20 jours</h2>');
    // La barre : chaque origine à sa part (9 CA, 15 RTT, 2 jours).
    expect(html).toContain('<span class="cet-window-reminder-bar" aria-hidden="true"><i class="annual" style="flex-grow:9"></i><i class="rtt" style="flex-grow:15"></i><i class="fraction" style="flex-grow:2"></i></span>');
    // Plus de jours versables (26) que la demande n'en admet (20) : on choisit.
    expect(html).toContain('<p class="cet-window-reminder-sources"><span>à prendre parmi</span><span class="annual"><strong>9</strong> CA</span><span class="rtt"><strong>15</strong> RTT</span><span class="fraction"><strong>2</strong> jours de fractionnement</span></p>');
    expect(html).toContain('<button type="button" class="cet-window-reminder-go">Préparer ma demande</button><small>D’après vos soldes. Ce rappel disparaît dès que l’alimentation est enregistrée dans Mon CET.</small></aside>');
    expect(html).not.toContain("Non, je n’ai pas de CET");
    expect(html).not.toContain("cet-symbol");
    // Pas plus de jours versables que la demande n'en admet : « soit ».
    const fewRtt = { "2026": { ...used(20)["2026"], rttUsed: 14 } };
    const exact = renderToStaticMarkup(<CetWindowReminder todayKey="2026-11-20" account={tracked()} periods={[]} group={2} manualAdjustments={fewRtt} {...handlers} />);
    expect(exact).toContain('<p class="cet-window-reminder-sources"><span>soit</span>');
  });

  it("devient pressant la dernière semaine", () => {
    const html = render("2026-12-27", tracked());
    expect(html).toContain('<span class="step-label urgent">CET · plus que 5 jours</span>');
    expect(html).toContain("<small>D’après vos soldes. La demande est à envoyer au plus tard le 31 décembre.</small>");
    expect(render("2026-12-31", tracked())).toContain("CET · dernier jour");
  });

  it("commence par la question du CET, avec Oui, Non et la demande d'ouverture", () => {
    const html = render("2026-11-20", undefined);
    expect(html).toContain('<aside class="cet-window-reminder setup"');
    expect(html).toContain('<li class="current" aria-current="step"><span class="cet-journey-mark" aria-hidden="true">1</span><small>Votre CET</small></li><li><span class="cet-journey-mark" aria-hidden="true">2</span><small>Son solde</small></li>');
    expect(html).toContain('<h2 id="cet-window-reminder-title">Avez-vous un CET ?</h2><p>Vos CA, RTT et jours de fractionnement non pris peuvent y être versés, en une seule demande par an.</p>');
    expect(html).toContain('<div class="cet-window-reminder-answers"><button type="button" class="cet-window-reminder-go">Oui</button><button type="button" class="cet-window-reminder-no" aria-label="Non, je n’ai pas de CET">Non</button></div>');
    // Pour qui n'en a pas encore, un encart à part sous la question.
    expect(html).toContain('<div class="cet-window-reminder-open"><p><strong>Pas encore de CET ?</strong> Vous pouvez en ouvrir un à tout moment de l’année.</p><button type="button" class="cet-window-reminder-no">Demander <span>l’ouverture<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg></span></button></div></aside>');
    expect(html).not.toContain("cet-window-reminder-link");
    // La même carte, avec les mêmes choix, pour qui a répondu « Je n'ai pas
    // de CET » : avant, plus rien ne lui proposait d'en ouvrir un.
    expect(render("2026-11-20", { ...tracked(), enabled: false })).toBe(html);
  });

  it("dit les CA qui manquent et mène au choix des congés", () => {
    const missing = render("2026-11-20", tracked(), 15);
    expect(missing).toContain('<aside class="cet-window-reminder missing"');
    expect(missing).toContain('<h2 id="cet-window-reminder-title">Encore 3 CA à poser</h2>');
    // La barre : 15 CA posés sur les 18 demandés.
    expect(missing).toContain('<span class="cet-window-reminder-bar" aria-hidden="true"><i class="taken" style="flex-grow:15"></i><i class="missing" style="flex-grow:3"></i></span>');
    expect(missing).toContain("<p>15 CA posés sur les 18 nécessaires pour verser des jours cette année.</p>");
    expect(missing).toContain('<button type="button" class="cet-window-reminder-go">Poser des congés</button>');
  });

  describe("« Plus tard » : la carte repliée en bandeau qui défile", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reste repliée les jours suivants et ne se redéplie d'elle-même que le 24 décembre", () => {
      expect(cetReminderFolded("", "2026-11-20")).toBe(false);
      expect(cetReminderFolded("2026-11-20", "2026-11-20")).toBe(true);
      expect(cetReminderFolded("2026-11-20", "2026-12-23")).toBe(true);
      expect(cetReminderFolded("2026-11-20", "2026-12-24")).toBe(false);
      // Repliée de nouveau pendant la dernière semaine : elle le reste.
      expect(cetReminderFolded("2026-12-24", "2026-12-30")).toBe(true);
      // Le repli de l'an dernier ne vaut pas pour cette année.
      expect(cetReminderFolded("2025-12-02", "2026-11-20")).toBe(false);
    });

    it("fait avancer le filet du 15 novembre au 31 décembre", () => {
      expect(cetWindowElapsed("2026-11-15")).toBe(2);
      expect(cetWindowElapsed("2026-11-20")).toBe(13);
      expect(cetWindowElapsed("2026-12-01")).toBe(36);
      expect(cetWindowElapsed("2026-12-27")).toBe(91);
      expect(cetWindowElapsed("2026-12-31")).toBe(100);
    });

    it("fait défiler le délai, ce qui attend et le geste", () => {
      expect(cetTickerParts(state("2026-11-20")!)).toEqual(["L’alimentation du CET est ouverte jusqu’au 31 décembre", "Vous pouvez verser jusqu’à 20 jours", "Touchez pour préparer votre demande"]);
      expect(cetTickerParts(state("2026-11-20", tracked(), 15)!)[1]).toBe("Il vous manque 3 CA posés pour y verser des jours");
      expect(cetTickerParts({ kind: "setup", daysLeft: 47 })).toEqual(["L’alimentation du CET est ouverte jusqu’au 31 décembre", "Indiquez le solde de votre CET pour savoir combien y verser", "Touchez pour l’indiquer"]);
      expect(cetTickerParts(state("2026-12-27")!)[0]).toBe("Plus que 5 jours pour alimenter votre CET");
      expect(cetTickerParts(state("2026-12-31")!)[0]).toBe("Dernier jour pour alimenter votre CET");
    });

    it("s'affiche en bandeau, nommé par ses phrases, à toucher pour redéplier la carte", () => {
      vi.stubGlobal("localStorage", { getItem: () => "2026-11-18", setItem: vi.fn() });
      const html = render("2026-11-20", tracked());
      expect(html).not.toContain("cet-window-reminder");
      expect(html).toContain('<button type="button" class="cet-ticker" aria-label="L’alimentation du CET est ouverte jusqu’au 31 décembre. Vous pouvez verser jusqu’à 20 jours. Touchez pour préparer votre demande."><span class="cet-ticker-label" aria-hidden="true">CET</span><span class="cet-ticker-window" aria-hidden="true">');
      // Deux copies à la suite pour la boucle, à vitesse de lecture constante.
      // Les phrases séparées par un losange (un <i> vide, dessiné en CSS).
      expect(html.match(/<span>L’alimentation du CET est ouverte jusqu’au 31 décembre<i><\/i>Vous pouvez verser jusqu’à 20\sjours<i><\/i>/g)).toHaveLength(2);
      expect(html).toMatch(/style="--ticker-duration:\d+s"/);
      // Le filet du bas : 6 jours sur 47 écoulés le 20 novembre.
      expect(html).toContain('<span class="cet-ticker-gauge" aria-hidden="true" style="--elapsed:13%"></span></button>');
      // La dernière semaine : étiquette orangée ; le 24, la carte se redéplie.
      vi.stubGlobal("localStorage", { getItem: () => "2026-12-26", setItem: vi.fn() });
      expect(render("2026-12-27", tracked())).toContain('class="cet-ticker urgent" aria-label="Plus que 5 jours pour alimenter votre CET.');
      vi.stubGlobal("localStorage", { getItem: () => "2026-11-18", setItem: vi.fn() });
      expect(render("2026-12-27", tracked())).toContain("Vous pouvez verser jusqu’à 20 jours</h2>");
    });
  });
});
