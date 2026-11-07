import { noteDisplayLines } from "./appModel";

/** Le texte d'une note, ligne à ligne : un point rond devant chaque ajout, et un
 *  texte qui reste aligné quand il revient à la ligne. */
export function NoteText({ text }: { text: string }) {
  return (
    <>
      {noteDisplayLines(text).map(({ key, bullet, text: line }) =>
        bullet ? (
          <span className="note-text-line bullet" key={key}>
            <i aria-hidden="true">•</i>
            <span>{line}</span>
          </span>
        ) : (
          // Une ligne vide garde sa hauteur : elle aère deux ajouts.
          <span className="note-text-line" key={key}>{line || " "}</span>
        ),
      )}
    </>
  );
}
