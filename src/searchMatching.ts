export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(left: string, right: string, limit: number) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost,
      );
      rowMinimum = Math.min(rowMinimum, current[rightIndex]);
    }
    if (rowMinimum > limit) return limit + 1;
    previous = current;
  }
  return previous[right.length];
}

function tokenMatches(words: string[], queryWord: string) {
  if (words.some((word) => word.includes(queryWord))) return true;
  if (queryWord.length < 4) return false;
  const tolerance = queryWord.length >= 10 ? 2 : 1;
  return words.some((word) => editDistance(word, queryWord, tolerance) <= tolerance);
}

/** Recherche lisible : ignore accents et ponctuation, puis accepte une petite
 * faute par mot sans élargir les requêtes très courtes. */
export function matchesSearch(value: string, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const normalizedValue = normalizeSearchText(value);
  if (normalizedValue.includes(normalizedQuery)) return true;
  const words = normalizedValue.split(" ").filter(Boolean);
  return normalizedQuery.split(" ").every((word) => tokenMatches(words, word));
}
