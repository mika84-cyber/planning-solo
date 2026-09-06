import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanningDayCell } from "./PlanningDayCell";

const baseProps = {
  date: new Date(2026, 8, 9),
  group: 2,
  cleanupSelected: false,
  today: false,
  recoveryEntries: [],
  showLeaves: true,
  showNotes: true,
  inPendingRange: false,
  rangeSelecting: false,
  recoveryRangeSelecting: false,
  noteSelecting: false,
  noteColor: "#d3943d",
  onClick: vi.fn(),
};

describe("PlanningDayCell", () => {
  it("ajoute les vacances scolaires sans remplacer les autres marqueurs", () => {
    const html = renderToStaticMarkup(
      <PlanningDayCell
        {...baseProps}
        schoolVacation={{
          name: "Vacances de la Toussaint",
          from: "2026-10-17",
          to: "2026-11-01",
        }}
      />,
    );
    expect(html).toContain("school-vacation-day");
    expect(html).toContain("Vacances de la Toussaint");
    expect(html).toContain("vacances scolaires");
  });

  it("annonce les congés et notes partagés par Agnès sans les transformer en congé personnel", () => {
    const html = renderToStaticMarkup(
      <PlanningDayCell
        {...baseProps}
        date={new Date(2026, 8, 10)}
        agnesLeave
        sharedNoteText="Rendez-vous partagé"
      />,
    );
    expect(html).toContain("agnes-leave-day");
    expect(html).not.toContain(" leave-day");
    expect(html).toContain("congé d’Agnès");
    expect(html).toContain("note d’Agnès");
    expect(html).toContain("agnes-leave-date");
    expect(html).not.toContain("agnes-leave-star");
    expect(html).toContain("note-band agnes-note-band");
  });

  it("partage le repère de note entre le bleu de Mika et le jaune d’Agnès", () => {
    const html = renderToStaticMarkup(
      <PlanningDayCell
        {...baseProps}
        entry={{
          noteText: "Note de Mika", noteColor: "#3478c5", noteUpdatedAt: "v1", noteGroupId: "",
          leave: false, wish: false, holidayPay: "", closureOverride: "", updatedAt: "v1",
        }}
        sharedNoteText="Note d’Agnès"
      />,
    );
    expect(html).toContain("note-band dual-note-band");
    expect(html).toContain("note d’Agnès");
  });

  it("conserve le tampon de fermeture et sa date accessible", () => {
    const html = renderToStaticMarkup(
      <PlanningDayCell
        {...baseProps}
        exceptionalClosure={{ label: "Fermeture exceptionnelle" }}
      />,
    );
    expect(html).toContain("exceptional-closure-date");
    expect(html).toContain("exceptional-closure-icon.webp");
    expect(html).toContain("Fermeture exceptionnelle");
    expect(html).toContain(">9</span>");
  });

  it("rend le type de congé et la note sans modifier les données", () => {
    const html = renderToStaticMarkup(
      <PlanningDayCell
        {...baseProps}
        entry={{
          noteText: "Réunion",
          noteColor: "#d3943d",
          noteUpdatedAt: "2026-09-01T10:00:00Z",
          noteGroupId: "",
          leave: false,
          wish: false,
          holidayPay: "",
          closureOverride: "",
          updatedAt: "2026-09-01T10:00:00Z",
        }}
        leavePeriod={{
          id: "leave-1",
          from: "2026-09-09",
          to: "2026-09-09",
          leaveType: "annual",
          updatedAt: "2026-09-01T10:00:00Z",
        }}
      />,
    );
    expect(html).toContain("leave-annual");
    expect(html).toContain("leave-calendar-marker-annual");
    expect(html).toContain("has-note");
    expect(html).toContain("Note enregistrée");
  });

  it("place les flèches en haut à droite et distingue le retour travaillé", () => {
    const html = renderToStaticMarkup(
      <PlanningDayCell
        {...baseProps}
        entry={{
          noteText: "", noteColor: "#D3943D", noteUpdatedAt: "", noteGroupId: "",
          leave: false, wish: false, holidayPay: "", closureOverride: "", updatedAt: "v2",
          exchangeId: "exchange-2026-a", exchangeRole: "return",
          exchangePartner: "Camille", exchangePartnerGroup: 1,
          exchangeOtherDate: "2026-09-01",
        }}
        exchange={{
          id: "exchange-2026-a", partnerName: "Camille", partnerGroup: 1,
          agreementDate: "2026-09-01", returnDate: "2026-09-09", updatedAt: "v2",
        }}
      />,
    );
    expect(html).toContain("exchange-day exchange-return");
    expect(html).toContain("exchange-calendar-marker");
    expect(html).toContain("/exchange-arrows.png");
    expect(html).toContain(">TRAVAIL</span>");
    expect(html).not.toContain("TRAVAIL · G1");
    expect(html).toContain("cycle groupe 1");
    expect(html).toContain("remplacement de Camille");
  });

  it("place le pictogramme accident de travail en bas à droite", () => {
    const html = renderToStaticMarkup(
      <PlanningDayCell
        {...baseProps}
        workAccident
        leavePeriod={{
          id: "at-1",
          from: "2026-09-09",
          to: "2026-09-09",
          leaveType: "work_accident",
          updatedAt: "v1",
        }}
      />,
    );
    expect(html).toContain("work-accident-day");
    expect(html).toContain("leave-work_accident");
    expect(html).toContain("work-accident-calendar-marker");
    expect(html).toContain("/work-accident-icon.png");
    expect(html).toContain("accident de travail");
  });
});
