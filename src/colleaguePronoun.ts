export type ColleagueObjectPronoun = "le" | "la" | "le/la";

const FEMININE_NAMES = new Set(
  "adriana alice amandine amelie anais audrey aurelie camille caroline charlotte chloe claire coralie celine delphine elise elodie emilie emma estelle eva florence gabrielle helene ines jade julie juliette laetitia laure lea lena lou louise lucie manon marie marion mathilde melanie morgane nadia naomi nathalie nina oceane pauline romane sabine sandrine sarah sophie stephanie valerie vanessa veronique vicky virginie zoe"
    .split(" "),
);

const MASCULINE_NAMES = new Set(
  "alexandre antoine baptiste cedric charles christophe claude damien dominique fabrice francois frederic gabriel guillaume jerome luca maxime michel nicolas olivier patrice philippe pierre samuel stephane thomas valentin vincent"
    .split(" "),
);

function normalizedFirstName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(madame|mme|monsieur|mr|m)\.?\s+/, "")
    .split(/[\s-]+/)[0]
    ?.replace(/[^a-z]/g, "") || "";
}

export function colleagueObjectPronoun(name: string): ColleagueObjectPronoun {
  const firstName = normalizedFirstName(name);
  if (!firstName) return "le/la";
  if (FEMININE_NAMES.has(firstName)) return "la";
  if (MASCULINE_NAMES.has(firstName)) return "le";
  if (/(?:a|ia|ina|ine|elle|ette|ise|issa|ie|ee)$/.test(firstName)) return "la";
  return "le";
}
