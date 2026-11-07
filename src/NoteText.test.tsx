import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NoteText } from "./NoteText";

const render = (text: string) => renderToStaticMarkup(<NoteText text={text} />);

describe("le texte d'une note", () => {
  it("met un point rond à la place du trait, lignes vides comprises", () => {
    const html = render("– Psy 11h45\n\n– Mécénat 18h30 / 22h30");
    expect(html.match(/note-text-line bullet/g)).toHaveLength(2);
    expect(html).toContain('<i aria-hidden="true">•</i><span>Psy 11h45</span>');
    expect(html).toContain('<i aria-hidden="true">•</i><span>Mécénat 18h30 / 22h30</span>');
    expect(html).not.toContain("–");
    expect(html).toContain('<span class="note-text-line"> </span>');
  });

  it("laisse tel quel un texte sans puce", () => {
    expect(render("Réunion d’équipe")).toBe('<span class="note-text-line">Réunion d’équipe</span>');
    // Un tiret collé à un nombre n'est pas une puce.
    expect(render("-5 % sur le billet")).not.toContain("bullet");
  });
});
