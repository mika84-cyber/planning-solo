import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { NoteListItem } from "./appModel";
import { UpcomingNoteList } from "./UpcomingNoteList";

const items: NoteListItem[] = [
  {
    key: "note-2026-10-02",
    date: "2026-10-02",
    label: "",
    detail: "",
    kind: "note",
    notes: [
      { author: "mika", label: "Récupérer le colis" },
      { author: "agnes", label: "Dîner chez Paul" },
    ],
  },
];

function render(authorColors?: boolean) {
  return renderToStaticMarkup(
    <UpcomingNoteList
      items={items}
      entries={{ "2026-10-02": { noteText: "Récupérer le colis" } as never }}
      ownNoteAuthorLabel="Mika"
      onOpenDate={() => undefined}
      onDeleteOwnNotes={() => undefined}
      onDeleteAgnesNote={() => undefined}
      authorColors={authorColors}
    />,
  );
}

describe("liste des notes", () => {
  it("colore chaque note selon son auteur sur le compte principal", () => {
    const html = render(true);
    expect(html).toContain("note-card note-card-colored");
    expect(html).toContain("note-card-part note-author-mika");
    expect(html).toContain("note-card-part note-author-agnes");
  });

  it("montre un point rond à la place du trait, sur la note de chacun", () => {
    const dashed: NoteListItem[] = [{
      ...items[0],
      notes: [
        { author: "mika", label: "– Psy 11h45\n\n– Mécénat 18h30 / 22h30" },
        { author: "agnes", label: "– Dîner chez Paul" },
      ],
    }];
    const html = renderToStaticMarkup(
      <UpcomingNoteList
        items={dashed}
        entries={{ "2026-10-02": { noteText: "– Psy 11h45" } as never }}
        ownNoteAuthorLabel="Mika"
        onOpenDate={() => undefined}
        onDeleteOwnNotes={() => undefined}
        onDeleteAgnesNote={() => undefined}
      />,
    );
    expect(html.match(/note-text-line bullet/g)).toHaveLength(3);
    expect(html).not.toContain("–");
  });

  it("garde des cartes neutres sur les autres comptes", () => {
    expect(render()).not.toContain("note-card-colored");
    expect(render(false)).not.toContain("note-card-colored");
  });
});
