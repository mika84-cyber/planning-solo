import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChoicePicker } from "./ChoicePicker";

const options = [
  { value: "full", label: "Temps plein" },
  { value: "half", label: "Mi-temps" },
];

describe("sélecteur de choix", () => {
  it("laisse le champ en attente tant que rien n’a été choisi", () => {
    // Afficher la première option ferait passer pour renseigné un champ que
    // personne n'a rempli : le libellé d'attente prend sa place, en retrait.
    const html = renderToStaticMarkup(
      <ChoicePicker
        value=""
        options={options}
        onChange={vi.fn()}
        ariaLabel="Choisir la quotité de travail"
        placeholder="À renseigner"
      />,
    );
    expect(html).toContain("choice-picker-trigger empty");
    expect(html).toContain("À renseigner");
    expect(html).not.toContain("Temps plein");
  });

  it("affiche le choix retenu sans marque d’attente", () => {
    const html = renderToStaticMarkup(
      <ChoicePicker
        value="half"
        options={options}
        onChange={vi.fn()}
        ariaLabel="Choisir la quotité de travail"
        placeholder="À renseigner"
      />,
    );
    expect(html).toContain("Mi-temps");
    expect(html).not.toContain("empty");
    expect(html).not.toContain("À renseigner");
  });

  it("place le complément après le choix, dans le bouton, avant le chevron", () => {
    const html = renderToStaticMarkup(
      <ChoicePicker
        value="half"
        options={options}
        onChange={vi.fn()}
        ariaLabel="Mois du calendrier"
        suffix={<em>2026</em>}
      />,
    );
    expect(html).toContain("<span>Mi-temps</span> <em>2026</em><svg");
    expect(html).toContain('aria-haspopup="listbox"');
  });

  it("annonce un panneau dès qu’un en-tête ou un pied entoure les options", () => {
    const html = renderToStaticMarkup(
      <ChoicePicker
        value="half"
        options={options}
        onChange={vi.fn()}
        ariaLabel="Mois du calendrier"
        panelLabel="Mois et année du calendrier"
        header={<em>2026</em>}
      />,
    );
    expect(html).toContain('aria-haspopup="dialog"');
    // Fermé, rien du panneau n'est rendu.
    expect(html).not.toContain("<em>2026</em>");
  });
});
