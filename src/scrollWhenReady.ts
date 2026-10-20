/** Amène à l'endroit exact où l'information se saisit. L'écran visé se
 *  charge à la demande : viser l'ancre tout de suite la manquerait, on
 *  réessaie donc brièvement. */
export function scrollWhenReady(id: string, attempts = 20) {
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (attempts > 0) window.setTimeout(() => scrollWhenReady(id, attempts - 1), 100);
}
