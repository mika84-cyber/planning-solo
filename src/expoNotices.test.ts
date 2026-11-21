import { describe, expect, it } from "vitest";
import { computeExpoNotices, expoNoticeDetail, expoNoticeHeading } from "./expoNotices";
import { GRAND_PALAIS_PROGRAM, type GrandPalaisProgramData } from "./grandPalaisProgramData";

const lines = (today: string, program: GrandPalaisProgramData = GRAND_PALAIS_PROGRAM) =>
  computeExpoNotices(program, today).map((notice) => `${expoNoticeHeading(notice)} | ${notice.venueLabel} · ${notice.title} | ${expoNoticeDetail(notice)}`);

describe("annonces d’exposition sur l’accueil", () => {
  it("annonce une ouverture la veille, et encore le jour même", () => {
    expect(lines("2026-11-30")).toEqual([]);
    expect(lines("2026-12-01")).toEqual(["Ouverture demain | Galerie 7 · Le Musée Imaginaire d’Oli | Jusqu’au 21 février 2027"]);
    // Le jour de l'ouverture, pour qui n'a pas ouvert l'application la veille ;
    // la Nef ouvre le lendemain.
    expect(lines("2026-12-02")).toEqual([
      "Ouverture aujourd’hui | Galerie 7 · Le Musée Imaginaire d’Oli | Jusqu’au 21 février 2027",
      "Ouverture demain | Nef · Adopt AI | Ouvert 2 jours, jusqu’au vendredi 4 décembre",
    ]);
    // Le lendemain de l'ouverture, la Galerie 7 ne s'annonce plus.
    expect(lines("2026-12-03")).toEqual(["Ouverture aujourd’hui | Nef · Adopt AI | Ouvert 2 jours, jusqu’au vendredi 4 décembre"]);
  });

  it("annonce une fermeture sept jours avant, jusqu’au dernier jour", () => {
    expect(lines("2027-01-09")).toEqual([]);
    expect(lines("2027-01-10")).toEqual(["Fermeture dans 7 jours | Galeries 3 et 4 · Cezanne et nous | Dernier jour : dimanche 17 janvier"]);
    expect(lines("2027-01-16")).toEqual(["Fermeture demain | Galeries 3 et 4 · Cezanne et nous | Dernier jour : dimanche 17 janvier"]);
    expect(lines("2027-01-17")).toEqual(["Dernier jour aujourd’hui | Galeries 3 et 4 · Cezanne et nous | "]);
    expect(lines("2027-01-18")).toEqual([]);
  });

  it("dans la Nef, une exposition d’une semaine ou moins n’a que le message de la veille, avec ses jours d’ouverture", () => {
    expect(lines("2026-11-24")).toEqual(["Ouverture demain | Nef · Arabian Horse Championship | Ouvert 3 jours, jusqu’au vendredi 27 novembre"]);
    // Aucun message de fermeture : ni la veille de la fin, ni le dernier jour.
    expect(lines("2026-11-26")).toEqual([]);
    expect(lines("2026-11-27")).toEqual([]);
    expect(lines("2026-12-04")).toEqual([]);
    // La patinoire dure plus d'une semaine : ses deux messages, comme une galerie.
    expect(lines("2026-12-11")).toEqual(["Ouverture demain | Nef · Le Grand Palais de Glace 2026 | Jusqu’au 6 janvier 2027"]);
    expect(lines("2026-12-30")).toEqual(["Fermeture dans 7 jours | Nef · Le Grand Palais de Glace 2026 | Dernier jour : mercredi 6 janvier"]);
  });

  it("compte les jours d’une exposition courte, d’une journée à une semaine", () => {
    const program = (endsOn: string): GrandPalaisProgramData => ({
      nef: { label: "Nef", heading: "Nef", schedule: { 2027: [{ title: "Un salon", period: "", startsOn: "2027-05-10", endsOn }] } },
    });
    expect(lines("2027-05-09", program("2027-05-10"))).toEqual(["Ouverture demain | Nef · Un salon | Ouvert une seule journée"]);
    // Sept jours : le message de la fin tomberait la veille de l'ouverture.
    expect(lines("2027-05-09", program("2027-05-16"))).toEqual(["Ouverture demain | Nef · Un salon | Ouvert 7 jours, jusqu’au dimanche 16 mai"]);
    expect(lines("2027-05-16", program("2027-05-16"))).toEqual([]);
    // Huit jours : les deux messages.
    expect(lines("2027-05-09", program("2027-05-17"))).toEqual(["Ouverture demain | Nef · Un salon | Jusqu’au 17 mai 2027"]);
    expect(lines("2027-05-10", program("2027-05-17"))).toEqual([
      "Ouverture aujourd’hui | Nef · Un salon | Jusqu’au 17 mai 2027",
      "Fermeture dans 7 jours | Nef · Un salon | Dernier jour : lundi 17 mai",
    ]);
  });

  it("n’annonce qu’une fois une exposition écrite dans deux années", () => {
    // « Cezanne et nous » figure en 2026 et en 2027 : une seule annonce, un seul repère.
    const notices = computeExpoNotices(GRAND_PALAIS_PROGRAM, "2027-01-12");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ id: "closing:galleries34:2027-01-17:cezanne nou", kind: "closing", days: 5 });
  });

  it("réunit les annonces d’une même semaine, la plus proche d’abord", () => {
    expect(lines("2027-03-14")).toEqual([
      "Fermeture dans 7 jours | Galerie 8 · Girls - Adolescence, mode et rébellion | Dernier jour : dimanche 21 mars",
      "Fermeture dans 7 jours | Galeries 9 et 10 · Mika Ninagawa with EiM - Alive with Shadows | Dernier jour : dimanche 21 mars",
    ]);
  });

  it("n’annonce pas une exposition « à confirmer »", () => {
    // Galeries 3 et 4, 23 mars 2027 ; Art Basel Paris dans la Nef, 20 octobre 2027.
    expect(lines("2027-03-22")).toEqual([]);
    expect(lines("2027-03-23")).toEqual([]);
    expect(lines("2027-10-19")).toEqual([]);
  });

  it("annonce aussi la Galerie 6.1 et le Palais des enfants", () => {
    const program: GrandPalaisProgramData = {
      "other:galerie-6-1": { label: "Galerie 6.1", heading: "Galerie 6.1", schedule: { 2027: [{ title: "Gilles Caron. J'ai voulu voir", period: "", startsOn: "2027-03-16", endsOn: "2027-07-24" }] } },
      childrenPalace: { label: "Palais des enfants", heading: "Palais des enfants", schedule: { 2027: [{ title: "Transparence", period: "", startsOn: "2025-06-20", endsOn: "2027-03-17" }] } },
      "other:salon-seine": { label: "Salon Seine", heading: "Salon Seine", schedule: { 2027: [{ title: "Un salon", period: "", startsOn: "2027-03-16", endsOn: "2027-03-18" }] } },
    };
    // Le Salon Seine ouvre aussi le 16 mars : les salons ne s'annoncent pas.
    expect(lines("2027-03-15", program)).toEqual([
      "Ouverture demain | Galerie 6.1 · Gilles Caron. J'ai voulu voir | Jusqu’au 24 juillet 2027",
      "Fermeture dans 2 jours | Palais des enfants · Transparence | Dernier jour : mercredi 17 mars",
    ]);
  });

  it("écrit « 1er » et ignore une date mal formée", () => {
    const program: GrandPalaisProgramData = {
      gallery7: { label: "Galerie 7", heading: "Galerie 7", schedule: { 2027: [
        { title: "Une exposition", period: "", startsOn: "2027-04-28", endsOn: "2027-08-01" },
        { title: "Sans date sûre", period: "", startsOn: "avril 2027" },
      ] } },
    };
    expect(lines("2027-04-27", program)).toEqual(["Ouverture demain | Galerie 7 · Une exposition | Jusqu’au 1er août 2027"]);
    expect(lines("2027-07-29", program)).toEqual(["Fermeture dans 3 jours | Galerie 7 · Une exposition | Dernier jour : dimanche 1er août"]);
    expect(computeExpoNotices(program, "aujourd’hui")).toEqual([]);
  });
});
