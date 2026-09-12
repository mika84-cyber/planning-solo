import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClockTimePicker } from "./ClockTimePicker";

describe("sélecteur d’heure commun", () => {
  it("propose 7 h à 2 h dans l’ordre et des quarts d’heure", () => {
    const html = renderToStaticMarkup(
      <ClockTimePicker label="Heure de début" value="" onChange={vi.fn()} />,
    );
    const hourLabels = [...html.matchAll(/<option[^>]*>(\d+ h)<\/option>/g)].map((match) => match[1]);
    expect(hourLabels).toEqual(["7 h", "8 h", "9 h", "10 h", "11 h", "12 h", "13 h", "14 h", "15 h", "16 h", "17 h", "18 h", "19 h", "20 h", "21 h", "22 h", "23 h", "0 h", "1 h", "2 h"]);
    expect(html).toContain('<option value="9" selected="">9 h</option>');
    expect(html).toContain('<option value="0" selected="">00</option>');
    expect(html).toContain('<option value="15">15</option>');
    expect(html).toContain('<option value="30">30</option>');
    expect(html).toContain('<option value="45">45</option>');
  });

  it("laisse le choix vide quand on l’y autorise, et ferme les minutes", () => {
    // Une liste déroulante affiche toujours une de ses options : sans option
    // vide, une heure serait proposée que personne n'a choisie.
    const html = renderToStaticMarkup(
      <ClockTimePicker label="Heure de début" value="" onChange={vi.fn()} allowEmpty />,
    );
    expect(html).toContain('<option value="" selected="">—</option>');
    expect(html).not.toContain('<option value="9" selected="">9 h</option>');
    expect(html).toContain("disabled");
  });

  it("rouvre les minutes dès qu’une heure est choisie", () => {
    const html = renderToStaticMarkup(
      <ClockTimePicker label="Heure de début" value="10:30" onChange={vi.fn()} allowEmpty />,
    );
    expect(html).toContain('<option value="10" selected="">10 h</option>');
    expect(html).toContain('<option value="30" selected="">30</option>');
    expect(html).not.toContain("disabled");
  });
});
