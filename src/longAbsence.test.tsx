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

  it("prépare le courrier à Madame Nida avec le nom, les dates et la date du jour", () => {
    const letter = longAbsenceLetter(
      { from: "2027-07-01", to: "2027-08-02", days: 33, byType: { annual: 18, rtt: 4 } },
      { fullName: "Mickaël Eliaszewicz" },
      new Date(2027, 4, 3),
    );
    const lines = letter.split("\n");
    expect(lines.slice(0, 5)).toEqual([
      "Mickaël Eliaszewicz",
      "DPU - SAP",
      "",
      "À l’attention de Madame Laurence Nida,",
      "Cheffe de service de l’accueil des publics.",
    ]);
    expect(letter).toContain("Objet : Demande de congés supérieurs à 31 jours consécutifs.");
    expect(letter).toContain("pour la période du 1er juillet 2027 au 2 août 2027 inclus.");
    expect(letter).toContain("[indiquer brièvement la raison si nécessaire]");
    expect(letter).toContain("je vous prie d’agréer, Madame Nida, l’expression de mes salutations distinguées.");
    expect(lines.slice(-2)).toEqual(["Mickaël Eliaszewicz", "Le 3 mai 2027"]);
    expect(longAbsenceLetter({ from: "2027-07-01", to: "2027-08-02", days: 33, byType: {} }, { fullName: " " }, new Date(2027, 4, 3))).toContain("[Nom prénom]");
  });

  it("signale l'absence et propose de rédiger le courrier", () => {
    const html = renderToStaticMarkup(
      <LongAbsenceNotice periods={[period("2027-07-01", "2027-08-02", "annual")]} group={2} todayKey="2027-01-01" sender={{ fullName: "" }} />,
    );
    expect(html).toContain("Absence de 33 jours consécutifs");
    expect(html).toContain("Rédiger le courrier");
    expect(renderToStaticMarkup(<LongAbsenceNotice periods={[]} group={2} todayKey="2027-01-01" sender={{ fullName: "" }} />)).toBe("");
  });
});

describe("infos congés", () => {
  it("explique le report, le fractionnement des agents d'accueil et les congés exceptionnels", () => {
    const html = renderToStaticMarkup(<LeaveInfoCard />);
    expect(html).toContain("<details class=\"leave-info-card\">");
    expect(html).toContain("Report des congés");
    // Un mémo à part, qui annonce des règles et non un solde.
    expect(html).toContain("<strong>Règles des congés</strong>");
    expect(html).toContain("À savoir");
    expect(html).toContain("Jusqu’au 30 avril suivant");
    expect(html).toContain("RTT : avant le 31 décembre");
    // Trois sortes de jours se reportent jusqu'au 30 avril suivant.
    for (const kind of ["Congés annuels", "Jours de fractionnement", "Fériés en récupération"])
      expect(html).toContain(`<li>${kind}</li>`);
    expect(html).toContain("Jours de fractionnement");
    expect(html).toContain("<strong>4 jours</strong><span>posés</span><b>+1 jour</b>");
    expect(html).toContain("<strong>7 jours</strong><span>ou plus</span><b>+2 jours</b>");
    expect(html.match(/<li class="counts">/g)).toHaveLength(6);
    expect(html).not.toContain("ASI");
    expect(html).toContain("Mariage ou PACS de l’agent");
    expect(html).toContain("Déménagement");
  });
});
