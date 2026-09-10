import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COLLEAGUE_GROUPS } from "../netlify/lib/colleagueGroups";
import { ColleagueGroupsDirectory, searchColleagueGroups } from "./ColleagueGroupsDirectory";

describe("détails des trois groupes", () => {
  it("classe uniquement des noms, sans doublon ni adresse e-mail", () => {
    const members = COLLEAGUE_GROUPS.flatMap((group) => group.members);
    const normalized = members.map((member) => member.normalize("NFKD").toLocaleLowerCase("fr"));

    expect(COLLEAGUE_GROUPS.map((group) => group.members.length)).toEqual([34, 36, 35]);
    expect(new Set(normalized).size).toBe(members.length);
    expect(members.every((member) => !member.includes("@"))).toBe(true);
    expect(COLLEAGUE_GROUPS[1].members).toContain("Mickaël Eliaszewicz");
    expect(COLLEAGUE_GROUPS[0].members).toContain("Erwan Ballan");
    expect(members).not.toContain("Erwan Ballian");
    expect(members).not.toContain("Maarten Averink");
    expect(members).not.toContain("Hicham Azalmat");
    expect(members).not.toContain("Mathieu Bohet");
    expect(members).not.toContain("Wilnise Cedelle");
    expect(members).not.toContain("Guillaume Fayon");
    expect(members).not.toContain("Priscilla Fantoli");
    expect(members).not.toContain("Simon Ladjouzi");
    expect(members).not.toContain("Astrid Metri");
    expect(members).not.toContain("Hubert Renard");
    expect(members).not.toContain("Thierry Medout-Marere");
    expect(members).not.toContain("Tarah Geoffre Orgusaare");
    expect(members).not.toContain("Paolo Sescousse");
    for (const group of COLLEAGUE_GROUPS) {
      expect(group.members).toEqual(
        [...group.members].sort((first, second) =>
          first.localeCompare(second, "fr", { sensitivity: "base" })),
      );
    }
  });

  it("affiche les compteurs et conserve le dossier principal fermé par défaut", () => {
    const html = renderToStaticMarkup(<ColleagueGroupsDirectory groups={COLLEAGUE_GROUPS} />);

    expect(html).toContain("Détails des 3 groupes");
    expect(html).toContain("105 collègues classés par groupe");
    expect(html).toContain("34 personnes");
    expect(html).toContain("36 personnes");
    expect(html).toContain("35 personnes");
    expect(html).toContain("Rechercher un collègue");
    expect(html).toContain('placeholder="Prénom ou nom"');
    expect(html).not.toContain("<details open=\"");
  });

  it("affiche immédiatement le dossier et ses compteurs avant l’arrivée des noms", () => {
    const html = renderToStaticMarkup(<ColleagueGroupsDirectory />);

    expect(html).toContain("Détails des 3 groupes");
    expect(html).toContain("105 collègues classés par groupe");
    expect(html).toContain("34 personnes");
    expect(html).toContain("36 personnes");
    expect(html).toContain("35 personnes");
    expect(html).toContain("Chargement des noms…");
  });

  it("recherche malgré un accent ou une petite faute et indique le groupe", () => {
    expect(searchColleagueGroups(COLLEAGUE_GROUPS, "mikael")).toEqual([
      { member: "Mickaël Eliaszewicz", group: 2 },
    ]);
  });
});
