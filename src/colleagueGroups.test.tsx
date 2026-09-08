import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COLLEAGUE_GROUPS } from "../netlify/lib/colleagueGroups";
import { ColleagueGroupsDirectory } from "./ColleagueGroupsDirectory";

describe("détails des trois groupes", () => {
  it("classe uniquement des noms, sans doublon ni adresse e-mail", () => {
    const members = COLLEAGUE_GROUPS.flatMap((group) => group.members);
    const normalized = members.map((member) => member.normalize("NFKD").toLocaleLowerCase("fr"));

    expect(COLLEAGUE_GROUPS.map((group) => group.members.length)).toEqual([34, 43, 35]);
    expect(new Set(normalized).size).toBe(members.length);
    expect(members.every((member) => !member.includes("@"))).toBe(true);
    expect(COLLEAGUE_GROUPS[1].members).toContain("Mickaël Eliaszewicz");
    expect(members).not.toContain("Maarten Averink");
    expect(members).not.toContain("Hicham Azalmat");
    expect(members).not.toContain("Mathieu Bohet");
    expect(members).not.toContain("Wilnise Cedelle");
    expect(members).not.toContain("Guillaume Fayon");
  });

  it("affiche les compteurs et conserve le dossier principal fermé par défaut", () => {
    const html = renderToStaticMarkup(<ColleagueGroupsDirectory groups={COLLEAGUE_GROUPS} />);

    expect(html).toContain("Détails des 3 groupes");
    expect(html).toContain("112 collègues classés par groupe");
    expect(html).toContain("34 personnes");
    expect(html).toContain("43 personnes");
    expect(html).toContain("35 personnes");
    expect(html).not.toContain("<details open=\"");
  });
});
