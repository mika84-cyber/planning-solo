import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyCetAccount } from "./cet";
import { CetWindowReminder, cetReminderFolded, cetTickerParts, cetWindowElapsed, cetWindowReminderState } from "./CetWindowReminder";

const remaining = { annual: 9, rtt: 15, fraction: 2 };
const tracked = () => ({ ...emptyCetAccount(), initialBalance: 5 });
const state = (todayKey: string, account = tracked(), annualDaysTaken = 20) =>
  cetWindowReminderState({ todayKey, account, annualDaysTaken, remaining, plannedLeaveDays: 0 });
const used = (annualUsed: number) => ({ "2026": { annualUsed, rttUsed: 0, fractionUsed: 0, sundayLeaveJanJun: 0, sundayLeaveJulSep: 0, sundayLeaveOctNov: 0, sundayLeaveDec: 0 } });
const render = (todayKey: string, account: ReturnType<typeof tracked> | undefined, annualUsed = 20) => renderToStaticMarkup(
  <CetWindowReminder todayKey={todayKey} account={account} periods={[]} group={2} manualAdjustments={used(annualUsed)} onPrepare={vi.fn()} onOpenCet={vi.fn()} onNoCet={vi.fn()} />,
);

describe("le rappel de l'alimentation du CET sur l'accueil", () => {
  it("ne s'affiche que du 15 novembre au 31 décembre, et compte les jours à partir du 24", () => {
    expect(state("2026-11-14")).toBeNull();
    expect(state("2027-01-01")).toBeNull();
    expect(state("2026-11-15")).toMatchObject({ kind: "open", total: 20 });
    expect(state("2026-12-24")?.daysLeft).toBe(8);
    expect(state("2026-12-31")?.daysLeft).toBe(1);
  });

  it("se tait pour qui n'a pas de CET, une fois l'alimentation enregistrée ou sans rien à verser", () => {
    expect(state("2026-11-20", { ...tracked(), enabled: false })).toBeNull();
    const deposited = tracked();
    deposited.operations = [{ id: "1", date: "2026-11-18", kind: "deposit", days: 4, source: "rtt" }];
    expect(state("2026-11-20", deposited)).toBeNull();
    // L'alimentation de l'an dernier n'empêche pas celle de cette année.
    deposited.operations[0].date = "2025-12-10";
    expect(state("2026-11-20", deposited)).toMatchObject({ kind: "open" });
    expect(cetWindowReminderState({ todayKey: "2026-11-20", account: tracked(), annualDaysTaken: 20, remaining: { annual: 0, rtt: 0, fraction: 0 }, plannedLeaveDays: 0 })).toBeNull();
  });

  it("demande le solde d'un CET non renseigné, ou dit les CA qui manquent", () => {
    expect(cetWindowReminderState({ todayKey: "2026-11-20", account: undefined, annualDaysTaken: 0, remaining, plannedLeaveDays: 0 })).toMatchObject({ kind: "setup" });
    expect(state("2026-11-20", tracked(), 15.5)).toMatchObject({ kind: "missing", missingDays: 2.5, minimum: 18, taken: 15.5 });
  });

  it("dit ce qui peut être versé et mène au formulaire d'alimentation", () => {
    const html = render("2026-11-20", tracked());
    expect(html).toContain('<aside class="cet-window-reminder" aria-labelledby="cet-window-reminder-title">');
    expect(html).toContain('<span class="step-label">CET · jusqu’au 31 décembre</span><h2 id="cet-window-reminder-title">L’alimentation est ouverte</h2>');
    // Plus de jours versables (26) que la demande n'en admet (20) : on choisit.
    expect(html).toContain("vous pouvez verser jusqu’à <strong>20 jours</strong> sur votre CET, à prendre parmi 9 CA, 15 RTT et 2 jours de fractionnement.");
    expect(html).toContain("Ce rappel disparaît dès qu’elle est enregistrée dans Mon CET.");
    expect(html).toContain('<button type="button" class="cet-window-reminder-go">Préparer ma demande</button>');
    expect(html).toContain(">Plus tard</button>");
    expect(html).not.toContain("Je n’ai pas de CET");
  });

  it("devient pressant la dernière semaine", () => {
    const html = render("2026-12-27", tracked());
    expect(html).toContain('<span class="step-label urgent">CET · plus que 5 jours</span>');
    expect(html).toContain("La demande est à envoyer au plus tard le 31 décembre.");
    expect(render("2026-12-31", tracked())).toContain("CET · dernier jour");
  });

  it("propose d'indiquer son solde, ou de dire qu'on n'a pas de CET", () => {
    const html = render("2026-11-20", undefined);
    expect(html).toContain("Vous avez un CET ?");
    expect(html).toContain(">Indiquer mon solde</button>");
    expect(html).toContain(">Je n’ai pas de CET</button>");
    const missing = render("2026-11-20", tracked(), 15);
    expect(missing).toContain("Il vous manque 3 CA posés");
    expect(missing).toContain("il faut avoir posé <strong>18 jours de CA</strong> dans l’année. Vous en avez posé 15.");
    expect(missing).toContain(">Voir mon CET</button>");
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
      expect(render("2026-12-27", tracked())).toContain("L’alimentation est ouverte</h2>");
    });
  });
});
