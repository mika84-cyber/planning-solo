import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MecenatSignupList } from "./MecenatSignupList";

describe("MecenatSignupList", () => {
  it("liste les dates d'inscription, la plus proche d'abord, avec « Retenir » et « Effacer »", () => {
    const html = renderToStaticMarkup(
      <MecenatSignupList
        signups={[
          { id: "b", date: "2026-11-14", start: "19:00", end: "22:30", updatedAt: "" },
          { id: "a", date: "2026-10-03", start: "", end: "", updatedAt: "" },
        ]}
        onAdd={vi.fn()}
        onRetain={vi.fn()}
        onDelete={vi.fn()}
        today={new Date(2026, 9, 24)}
      />,
    );
    expect(html).toContain('aria-label="Mes dates d’inscription"');
    // La date passée sans suite se signale ; la suivante attend.
    expect(html).toMatch(/<li class="is-past"><time dateTime="2026-10-03"><b>Samedi 3 octobre<\/b><small>date passée · à retenir ou à effacer<\/small>[\s\S]*<li><time dateTime="2026-11-14"><b>Samedi 14 novembre<\/b><small>19:00 → 22:30 · en attente<\/small>/);
    expect(html).toContain('aria-label="Retenir le 3 octobre"');
    expect(html).toContain('aria-label="Effacer le 14 novembre"');
    expect(html).toContain("2 dates en attente");
    expect(html).toContain('type="date"');
    expect(html).toContain("Heure de début");
    expect(html).toContain("Heure de fin");
  });

  it("dit quand il n'y a encore aucune date", () => {
    const html = renderToStaticMarkup(<MecenatSignupList signups={[]} onAdd={vi.fn()} onRetain={vi.fn()} onDelete={vi.fn()} />);
    expect(html).toContain("Aucune date d’inscription pour l’instant.");
    expect(html).not.toContain("en attente</p>");
  });
});
