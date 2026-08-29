import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("formulaire de demande", () => {
  const html = readFileSync("public/formulaire/index.html", "utf8");
  const deviceScript = readFileSync("public/formulaire/device.js", "utf8");
  const sheetsScript = readFileSync("public/formulaire/sheets.js", "utf8");
  const formScript = readFileSync("public/formulaire/app.js", "utf8");
  const signatureController = readFileSync("public/formulaire/form-signature-controller.js", "utf8");
  const formStyles = readFileSync("public/formulaire/form.css", "utf8");
  const serviceWorker = readFileSync("public/formulaire/sw.js", "utf8");
  const formSources = `${html}\n${deviceScript}\n${sheetsScript}\n${formScript}\n${signatureController}`;
  const netlifyConfig = readFileSync("netlify.toml", "utf8");
  const app = [
    "src/App.tsx",
    "src/AppNavigation.tsx",
    "src/HomeDashboard.tsx",
    "src/PayPage.tsx",
    "src/PdfDownloadPage.tsx",
    "src/UsefulFormsSection.tsx",
  ].map((file) => readFileSync(file, "utf8")).join("\n");

  it("charge ses ressources locales sans script ni style intégrés", () => {
    expect(html).not.toMatch(/<script(?![^>]+src=)[^>]*>/);
    expect(html).not.toContain("<style>");
    expect(html).toContain('<script src="device.js"></script>');
    expect(html).toContain('<link rel="stylesheet" href="form.css">');
    expect(html).toContain('<script src="sheets.js"></script>');
    expect(html).toContain('<script type="module" src="app.js"></script>');
    expect(netlifyConfig).toContain("script-src 'self'");
    expect(netlifyConfig).toContain("style-src 'self'");
    expect(formStyles).toContain("@media print");
    expect(sheetsScript).toMatch(/^var SHEETS = \[/);
    for (const asset of [
      "device.js",
      "form.css",
      "sheets.js",
      "app.js",
      "form-value-utils.js",
      "form-calendar.js",
      "form-file-utils.js",
      "form-signature-controller.js",
    ])
      expect(serviceWorker).toContain(`'./${asset}'`);
    expect(formScript).toContain("from './form-value-utils.js'");
    expect(formScript).toContain("from './form-calendar.js'");
    expect(formScript).toContain("from './form-file-utils.js'");
    expect(formScript).toContain("from './form-signature-controller.js'");
    expect(formScript).toContain("createSignatureController({");
    expect(formScript).toContain("function closeSigSavePrompt(){ signatureController.closeSavePrompt(); }");
    expect(signatureController).toMatch(/return \{[\s\S]*closeSavePrompt,/);
  });

  it("garde une seule source de version pour le cache hors ligne", () => {
    expect(serviceWorker).toMatch(/var VERSION = '\d+';/);
    expect(serviceWorker).toContain("var CACHE = 'demandes-' + VERSION;");
    expect(formScript).toContain("register('sw.js', {updateViaCache:'none'})");
    expect(formScript).not.toMatch(/sw\.js\?v=/);
  });

  it("conserve les briques de préremplissage, signature et PDF", () => {
    expect(formSources).toContain("planning:form-handoff-v1");
    expect(html).toContain('id="sigModal"');
    expect(html).toContain('id="btnPdf"');
    expect(formSources).toContain("demandes:v4:");
    expect(formSources).toContain("item.type==='recovery_training')?'rheur'");
    expect(formSources).toContain("capacities={ca:5,artt:4,cet:4,frac:2");
    expect(formSources).toContain("syncSavedSignatureToPlanning");
    expect(signatureController).toContain("action: 'save-form-profile'");
    expect(signatureController).toContain("signature: data");
    expect(formSources).toContain("font:obsBold,color:PDFLib.rgb(INK[0]/255,INK[1]/255,INK[2]/255)");
  });

  it("confirme la demande dans le planning seulement après la finalisation", () => {
    expect(formScript).toContain("action:'save-request'");
    expect(formScript).toContain("await completePlanningRequest(pdf)");
    expect(formScript).toContain("planning-request-archive");
    expect(formScript).toContain("data.requestKind==='leave' && c.n==='opt_conges'");
    expect(formScript.indexOf("syncPlanningRequest()"))
      .toBeLessThan(formScript.indexOf("localStorage.removeItem(PLANNING_HANDOFF_KEY)"));
  });

  it("distingue un succès de synchronisation d'une erreur ou d'un avertissement PDF", () => {
    expect(app).toContain('confirm("La demande est enregistrée : le planning et les soldes sont à jour.")');
    expect(app).not.toContain('notify("La demande est enregistrée : le planning et les soldes sont à jour.")');
    expect(formScript).toContain("finishSavedRequestAfterDeliveryIssue");
    expect(formScript).toContain("if(!planningImport || !planningSyncDone) return false");
    expect(formScript).toContain("planningArchiveDone=await archivePlanningRequest(pdf)");
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
    expect(app).toContain('onChooseGroup={() => setGroupChooserOpen(true)}');
  });
});
