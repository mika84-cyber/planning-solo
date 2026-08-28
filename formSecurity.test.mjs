import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("formulaire de demande", () => {
  const html = readFileSync("public/formulaire/index.html", "utf8");
  const netlifyConfig = readFileSync("netlify.toml", "utf8");
  const app = readFileSync("src/App.tsx", "utf8");

  it("autorise précisément chacun de ses scripts intégrés", () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(3);

    for (const script of scripts) {
      const hash = createHash("sha256").update(script[1]).digest("base64");
      expect(netlifyConfig).toContain(`'sha256-${hash}'`);
    }
  });

  it("conserve les briques de préremplissage, signature et PDF", () => {
    expect(html).toContain("planning:form-handoff-v1");
    expect(html).toContain('id="sigModal"');
    expect(html).toContain('id="btnPdf"');
    expect(html).toContain("demandes:v4:");
    expect(html).toContain("item.type==='recovery_training')?'rheur'");
    expect(html).toContain("capacities={ca:5,artt:4,cet:4,frac:2");
    expect(html).toContain("syncSavedSignatureToPlanning");
    expect(html).toContain("action:'save-form-profile',fullName:fullName,group:group,signature:data");
    expect(html).toContain("font:obsBold,color:PDFLib.rgb(INK[0]/255,INK[1]/255,INK[2]/255)");
  });

  it("confirme la demande dans le planning seulement après la finalisation", () => {
    expect(html).toContain("action:'save-request'");
    expect(html).toContain("await completePlanningRequest(pdf)");
    expect(html).toContain("planning-request-archive");
    expect(html).toContain("data.requestKind==='leave' && c.n==='opt_conges'");
    expect(html.indexOf("syncPlanningRequest()"))
      .toBeLessThan(html.indexOf("localStorage.removeItem(PLANNING_HANDOFF_KEY)"));
  });

  it("distingue un succès de synchronisation d'une erreur ou d'un avertissement PDF", () => {
    expect(app).toContain('confirm("La demande est enregistrée : le planning et les soldes sont à jour.")');
    expect(app).not.toContain('notify("La demande est enregistrée : le planning et les soldes sont à jour.")');
    expect(html).toContain("finishSavedRequestAfterDeliveryIssue");
    expect(html).toContain("if(!planningImport || !planningSyncDone) return false");
    expect(html).toContain("planningArchiveDone=await archivePlanningRequest(pdf)");
  });

  it("conserve les points d'entrée de la nouvelle navigation", () => {
    for (const label of [
      "Que souhaitez-vous poser ?",
      "Un congé",
      "Une récupération",
      "Primes et jours fériés",
      "Bulletins et estimations",
      "Télécharger les plannings en PDF",
      "Afficher les vacances scolaires",
    ]) expect(app).toContain(label);
    expect(app).toContain('className="native-back-button"');
    expect(app).toContain('onClick={() => setGroupChooserOpen(true)}');
  });
});
