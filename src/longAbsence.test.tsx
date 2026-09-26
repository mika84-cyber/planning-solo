import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeaveInfoCard } from "./LeaveInfoCard";
import { LongAbsenceNotice } from "./LongAbsenceNotice";
import { longAbsenceLetter, longAbsences } from "./longAbsence";

const period = (from: string, to: string, leaveType: string) => ({ from, to, leaveType, group: 2 });

describe("absences de 31 jours et plus", () => {
  it("réunit les congés séparés par des repos et compte du premier au dernier jour posé", () => {
    // Deux périodes qui se suivent : une seule absence de 33 jours.
    const [absence] = longAbsences([period("2027-07-01", "2027-07-20", "annual"), period("2027-07-21", "2027-08-02", "rtt")], 2, "2027-01-01");
    expect(absence).toMatchObject({ from: "2027-07-01", to: "2027-08-02", days: 33 });
    expect((absence.byType.annual || 0) + (absence.byType.rtt || 0)).toBeGreaterThan(0);
  });

  it("ignore les absences courtes, terminées ou de maladie", () => {
    expect(longAbsences([period("2027-07-01", "2027-07-30", "annual")], 2, "2027-01-01")).toEqual([]);
    expect(longAbsences([period("2027-07-01", "2027-08-10", "annual")], 2, "2027-09-01")).toEqual([]);
    expect(longAbsences([period("2027-07-01", "2027-08-10", "sick")], 2, "2027-01-01")).toEqual([]);
  });

  it("coupe l'absence dès qu'un jour travaillé la sépare", () => {
    const runs = longAbsences([period("2027-07-01", "2027-07-20", "annual"), period("2027-08-16", "2027-08-31", "annual")], 2, "2027-01-01");
    expect(runs).toEqual([]);
  });

  it("prépare un courrier à la cheffe de service avec les dates et le détail", () => {
    const letter = longAbsenceLetter(
      { from: "2027-07-01", to: "2027-08-02", days: 33, byType: { annual: 18, rtt: 4 } },
      { fullName: "Mika Exemple", job: "Agent d’accueil", group: 2 },
      new Date(2027, 4, 3),
    );
    expect(letter).toContain("Mika Exemple\nAgent d’accueil — groupe 2");
    expect(letter).toContain("À l’attention de Madame la cheffe de service");
    expect(letter).toContain("du jeudi 1er juillet 2027 au lundi 2 août 2027, soit 33 jours consécutifs, en posant 18 jours de congés annuels et 4 RTT.");
    expect(letter).toContain("[Précisez ici le motif de votre demande.]");
    expect(letter).toContain("Le 3 mai 2027");
  });

  it("signale l'absence et propose de rédiger le courrier", () => {
    const html = renderToStaticMarkup(
      <LongAbsenceNotice periods={[period("2027-07-01", "2027-08-02", "annual")]} group={2} todayKey="2027-01-01" sender={{ fullName: "", job: "Agent d’accueil", group: 2 }} />,
    );
    expect(html).toContain("Absence de 33 jours consécutifs");
    expect(html).toContain("Rédiger le courrier");
    expect(renderToStaticMarkup(<LongAbsenceNotice periods={[]} group={2} todayKey="2027-01-01" sender={{ fullName: "", job: "", group: 2 }} />)).toBe("");
  });
});

describe("infos congés", () => {
  it("explique le fractionnement et le barème des congés exceptionnels", () => {
    const html = renderToStaticMarkup(<LeaveInfoCard />);
    expect(html).toContain("<details class=\"leave-info-card\">");
    expect(html).toContain("Jours de fractionnement");
    expect(html).toContain("Agent d’accueil, caissier, GTC de jour");
    expect(html).toContain("4 gardes → 1 garde · 7 gardes → 2 gardes");
    expect(html).toContain("4 jours → 1 jour · 7 jours → 2 jours");
    expect(html).toContain("2 gardes → ½ garde · 3 gardes → 1 garde");
    expect(html).toContain("Mariage ou PACS de l’agent");
    expect(html).toContain("5 jours");
    expect(html).toContain("Déménagement");
  });
});
