import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { ColleagueGroupsDirectory } from "./ColleagueGroupsDirectory";
import { genderOfColleague, rememberColleagueGenders } from "./colleagueGenders";
import { colleagueObjectPronoun } from "./colleaguePronoun";

const groups = [{ number: 1 as const, members: ["Auricio Lemos Bomfim", "Mika Durand", "Nikky"] }];

describe("genre des collègues", () => {
  afterEach(() => rememberColleagueGenders({}));

  it("préfère le genre enregistré à la supposition tirée du prénom", () => {
    expect(colleagueObjectPronoun("Mika Durand")).toBe("la");
    rememberColleagueGenders({ "Mika Durand": "h" });
    expect(colleagueObjectPronoun("Mika Durand")).toBe("le");
    // Un prénom seul retrouve la personne quand il n'y a pas d'ambiguïté.
    expect(colleagueObjectPronoun("mika")).toBe("le");
  });

  it("ne tranche pas sur un prénom partagé par un homme et une femme", () => {
    rememberColleagueGenders({ "Camille Martin": "f", "Camille Petit": "h" });
    expect(genderOfColleague("Camille Martin")).toBe("f");
    expect(genderOfColleague("Camille")).toBeUndefined();
  });

  it("ne montre les choix H/F qu'à l'administratrice, et seulement pour les noms sans genre", () => {
    rememberColleagueGenders({ "Nikky": "f" });
    const guest = renderToStaticMarkup(<ColleagueGroupsDirectory groups={groups} />);
    expect(guest).not.toContain("colleague-gender-choice");
    const admin = renderToStaticMarkup(<ColleagueGroupsDirectory groups={groups} isAdmin />);
    expect(admin.match(/class="colleague-gender-choice"/g)).toHaveLength(2);
    expect(admin).toContain("Auricio Lemos Bomfim : homme");
    expect(admin).not.toContain("Nikky : homme");
    expect(admin).toContain("2 sans H/F");
  });
});
