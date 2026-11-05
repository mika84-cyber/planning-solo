import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkExchangeDialog } from "./WorkExchangeDialog";

describe("WorkExchangeDialog", () => {
  it("présente trois étapes : votre collègue d’abord, puis votre journée et la sienne", () => {
    const html = renderToStaticMarkup(
      <WorkExchangeDialog
        open
        group={2}
        draft={{
          id: "",
          partnerName: "Camille",
          partnerGroup: 1,
          agreementDate: "",
          returnDate: "",
          agreementStart: "",
          agreementEnd: "",
          returnStart: "10:00",
          returnEnd: "18:00",
        }}
        setDraft={vi.fn()}
        error="Les deux dates de l’échange sont obligatoires."
        saving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(html).toContain("Faire un échange");
    // Deux onglets, la même structure.
    expect(html).toContain(">Journée<");
    expect(html).toContain(">Jour férié<");
    // Une journée : pas d'encadré, la demande d'échange va de soi.
    expect(html).not.toContain("xch-sheet");
    expect(html).toContain("Votre journée");
    expect(html).toContain("Groupe 2 · Camille vous remplace");
    expect(html).toContain("Votre collègue");
    expect(html).toContain("Sa journée");
    expect(html).toContain("Groupe 1 · Vous remplacez Camille");
    // Le collègue d'abord : il ouvre le calendrier de vos journées possibles.
    expect(html.indexOf("Votre collègue")).toBeLessThan(html.indexOf("Votre journée"));
    expect(html.indexOf("Votre journée")).toBeLessThan(html.indexOf("Sa journée"));
    expect(html).toContain('aria-label="Cycle de travail du groupe 2"');
    // Sa journée attend la vôtre.
    expect(html).toContain("Choisissez d’abord votre journée.");
    expect(html).toContain("Les deux dates de l’échange sont obligatoires.");
    expect(html).toContain("Choisir la journée de votre cycle");
    expect((html.match(/type="date"/g) || []).length).toBe(0);
    expect(html).toContain('aria-label="Horaires de la journée de votre cycle"');
    expect(html).toContain('aria-label="Horaires de la journée de son cycle"');
    expect(html).toContain("Valider l’échange");
    // Un nouvel échange ouvre ensuite la demande à remplir, interrupteur activé.
    expect(html).toMatch(/<input type="checkbox" role="switch" checked=""[^>]*\/><span>Remplir la demande ensuite<\/span>/);
  });

  it("modifie un échange enregistré sans rouvrir la demande, sauf si on le choisit", () => {
    const html = renderToStaticMarkup(
      <WorkExchangeDialog
        open
        group={3}
        draft={{
          id: "exchange-1",
          partnerName: "Camille",
          partnerGroup: 1,
          agreementDate: "",
          returnDate: "",
          agreementStart: "09:15",
          agreementEnd: "17:30",
          returnStart: "09:15",
          returnEnd: "17:30",
        }}
        setDraft={vi.fn()}
        error=""
        saving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(html).toContain("Enregistrer les modifications");
    expect(html).toMatch(/<input type="checkbox" role="switch"\/><span>Remplir la demande ensuite<\/span>/);
  });

  it("attend le collègue avant de proposer des dates", () => {
    const html = renderToStaticMarkup(
      <WorkExchangeDialog open group={2}
        draft={{ id: "", partnerName: "", partnerGroup: 1, agreementDate: "", returnDate: "", agreementStart: "", agreementEnd: "", returnStart: "", returnEnd: "" }}
        setDraft={vi.fn()} error="" saving={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />,
    );
    expect((html.match(/Choisissez d’abord votre collègue\./g) || []).length).toBe(2);
    expect(html).not.toContain("Choisir la journée de votre cycle");
    expect(html).not.toContain("Horaires de la journée");
  });

  it("propose d’abord les collègues libres le jour déjà choisi, sans griser les autres groupes", async () => {
    const { getDayInfo, dateKey } = await import("./planningLogic");
    const day = Array.from({ length: 31 }, (_, index) => new Date(2026, 11, index + 1, 12))
      .find((date) => getDayInfo(date, 2).kind === "work" && !getDayInfo(date, 2).holiday
        && [1, 3].filter((other) => getDayInfo(date, other).kind === "off").length === 1)!;
    const offGroup = [1, 3].find((other) => getDayInfo(day, other).kind === "off")!;
    const html = renderToStaticMarkup(
      <WorkExchangeDialog open group={2}
        draft={{ id: "", partnerName: "", partnerGroup: offGroup, agreementDate: dateKey(day), returnDate: "", agreementStart: "", agreementEnd: "", returnStart: "", returnEnd: "" }}
        setDraft={vi.fn()} error="" saving={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(html).toContain(`En repos ce jour-là : groupe ${offGroup}`);
    expect(html).not.toMatch(/disabled="" class="group-/);
  });

  describe("onglet Jour férié", () => {
    afterEach(() => vi.useRealTimers());

    it("ne propose que vos fériés où votre collègue est en repos, et les siens d’emblée", () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 10, 5, 12));
      const html = renderToStaticMarkup(
        <WorkExchangeDialog open group={2}
          draft={{ id: "", partnerName: "Maurizio Campani", partnerGroup: 1, agreementDate: "2027-05-16", returnDate: "", agreementStart: "", agreementEnd: "", returnStart: "", returnEnd: "" }}
          setDraft={vi.fn()} error="" saving={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />,
      );
      expect(html).toContain('aria-selected="true" class="active">Jour férié<');
      expect(html).toContain("chacun cède le sien sur une demande de remplacement");
      // Vos fériés : la Pentecôte, où Maurizio est en repos ; pas l'Assomption, où il travaille.
      expect(html).toMatch(/aria-checked="true" class="xch-choice selected"><strong>Dimanche de Pentecôte<\/strong>/);
      expect(html).not.toContain("Assomption");
      // Ses fériés de 2027, où vous le remplacez.
      expect(html).toContain('aria-label="Choisir le férié du cycle du collègue"');
      expect(html).toContain("Groupe 1 · Vous remplacez Maurizio Campani");
      expect(html).toContain("Jour de l’an");
      // Et ceux encore à venir en 2026, avant votre férié.
      expect(html).toContain("mercredi 11 novembre 2026");
      expect(html).not.toContain("Choisissez d’abord");
    });
  });
});
