import { writeFile } from "node:fs/promises";

const version = await fetch("http://127.0.0.1:9224/json/version").then((response) => response.json());
const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 0;
const pending = new Map();
let activeSession = "";
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Page.javascriptDialogOpening" && activeSession) {
    void send("Page.handleJavaScriptDialog", { accept: true }, activeSession);
    return;
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject, method } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(`${method}: ${message.error.message}`));
  else resolve(message.result);
});
function send(method, params = {}, sessionId) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
}
const target = await send("Target.createTarget", { url: "about:blank" });
const attached = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
const session = attached.sessionId;
activeSession = session;
const call = (method, params = {}) => send(method, params, session);
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return result.result.value;
};
async function waitFor(expression, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Délai dépassé : ${expression}`);
}
async function viewport(width, height) {
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 720 });
}
await call("Page.enable");
await call("Runtime.enable");
await call("Storage.clearDataForOrigin", {
  origin: "http://127.0.0.1:5173",
  storageTypes: "all",
});
await viewport(390, 844);
await call("Page.navigate", { url: "http://127.0.0.1:5173/?demo=1" });
await waitFor("document.querySelector('.today-overview') && document.querySelector('.month-card')");
await waitFor("document.querySelector('.guide-prompt-modal')");
const guidePrompt = await evaluate(`(() => ({
  title: document.querySelector('#guide-prompt-title')?.textContent,
  actions: [...document.querySelectorAll('.guide-prompt-actions button')].map(node => node.textContent.trim())
}))()`);
if (!guidePrompt.actions.includes("Consulter") || !guidePrompt.actions.includes("Passer"))
  throw new Error("Le premier lancement ne propose pas les deux choix du mode d’emploi.");
const guidePromptCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-guide-prompt-mobile.png", Buffer.from(guidePromptCapture.data, "base64"));
await evaluate("[...document.querySelectorAll('.guide-prompt-actions button')].find(node => node.textContent.includes('Passer')).click()");
await waitFor("!document.querySelector('.guide-prompt-modal')");

const mobile = await evaluate(`(() => ({
  width: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  todayCards: document.querySelectorAll('.today-overview-grid > *').length,
  notes: document.querySelector('#home-notes-title')?.textContent,
  planning: document.querySelector('#home-planning-title')?.textContent,
  leaveCentered: getComputedStyle(document.querySelector('.today-leave-balance')).textAlign,
  groupCentered: getComputedStyle(document.querySelector('.today-group-card')).textAlign,
  todayAndNextAligned: Math.abs(document.querySelector('.today-status').getBoundingClientRect().top - document.querySelector('.today-next-work').getBoundingClientRect().top) < 2,
  leaveAndGroupAligned: Math.abs(document.querySelector('.today-leave-balance').getBoundingClientRect().top - document.querySelector('.today-group-card').getBoundingClientRect().top) < 2,
  leaveAndGroupSeparated: document.querySelector('.today-leave-balance').getBoundingClientRect().right <= document.querySelector('.today-group-card').getBoundingClientRect().left + 1,
  equalCardSizes: (() => {
    const cards = [...document.querySelectorAll('.today-overview-grid > *')].map((node) => node.getBoundingClientRect());
    return cards.every((card) => Math.abs(card.width - cards[0].width) < 2 && Math.abs(card.height - cards[0].height) < 2);
  })(),
  centeredCardContent: [...document.querySelectorAll('.today-overview-grid .today-card-copy')].every((node) => {
    const card = node.closest('article, button').getBoundingClientRect();
    const copy = node.getBoundingClientRect();
    return Math.abs((copy.left + copy.width / 2) - (card.left + card.width / 2)) < 2 &&
      Math.abs((copy.top + copy.height / 2) - (card.top + card.height / 2)) < 2;
  }),
  iconsRemoved: [...document.querySelectorAll('.today-overview-grid .today-card-icon')]
    .every((node) => getComputedStyle(node).display === 'none'),
  headerControlsAdjacent: (() => {
    const actions = document.querySelector('.header-actions').getBoundingClientRect();
    const menu = document.querySelector('.main-menu-button').getBoundingClientRect();
    const title = document.querySelector('.top-header-title').getBoundingClientRect();
    return actions.right <= menu.left + 1 && menu.left - actions.right <= 10 && title.right <= actions.left + 1;
  })()
}))()`);
if (mobile.scrollWidth > mobile.width) throw new Error(`Débordement mobile : ${mobile.scrollWidth}px pour ${mobile.width}px`);
if (mobile.todayCards !== 4 || mobile.notes !== "Mes notes" || mobile.planning !== "Mon planning" || !mobile.todayAndNextAligned || !mobile.leaveAndGroupAligned || !mobile.leaveAndGroupSeparated || !mobile.equalCardSizes || !mobile.centeredCardContent || !mobile.iconsRemoved || !mobile.headerControlsAdjacent)
  throw new Error(`L'accueil mobile ne contient pas les trois zones attendues : ${JSON.stringify(mobile)}`);
const mobilePlanningAction = await evaluate(`(() => {
  const mobile = document.querySelector('.planning-leave-mobile');
  const desktop = document.querySelector('.planning-leave-desktop');
  const worked = document.querySelector('.worked-days')?.getBoundingClientRect();
  const group = document.querySelector('.planning-group-choice')?.getBoundingClientRect();
  const action = mobile?.getBoundingClientRect();
  const controls = document.querySelector('.controls')?.getBoundingClientRect();
  const today = document.querySelector('.month-toolbar .today-button')?.getBoundingClientRect();
  const period = document.querySelector('.month-toolbar .period-navigation')?.getBoundingClientRect();
  return {
    mobileVisible: mobile && getComputedStyle(mobile).display !== 'none',
    desktopVisible: desktop && getComputedStyle(desktop).display !== 'none',
    groupAndWorkedAligned: Boolean(worked && group && Math.abs(worked.top - group.top) < 2),
    actionBelow: Boolean(action && worked && group && action.top > Math.max(worked.bottom, group.bottom)),
    actionFullWidth: Boolean(action && controls && action.width > controls.width - 24),
    todayFullWidth: Boolean(today && period && Math.abs(today.width - period.width) < 2),
  sameControlTypography: (() => {
      const workedStyle = getComputedStyle(document.querySelector('.worked-days-trigger'));
      const groupStyle = getComputedStyle(document.querySelector('.planning-group-choice .choice-picker-trigger'));
      return workedStyle.fontFamily === groupStyle.fontFamily && workedStyle.fontSize === groupStyle.fontSize && workedStyle.fontWeight === groupStyle.fontWeight;
    })(),
    workedLabelCentered: (() => {
      const label = document.querySelector('.worked-days > .year-choice-label').getBoundingClientRect();
      const frame = document.querySelector('.worked-days-stepper').getBoundingClientRect();
      return Math.abs((label.left + label.width / 2) - (frame.left + frame.width / 2)) < 1;
    })(),
    dayMinHeight: document.querySelector('.month-card .day').getBoundingClientRect().height
  };
})()`);
if (!mobilePlanningAction.mobileVisible || mobilePlanningAction.desktopVisible || !mobilePlanningAction.groupAndWorkedAligned || !mobilePlanningAction.actionBelow || !mobilePlanningAction.actionFullWidth || !mobilePlanningAction.todayFullWidth || !mobilePlanningAction.sameControlTypography || !mobilePlanningAction.workedLabelCentered || mobilePlanningAction.dayMinHeight < 53)
  throw new Error(`Les commandes du planning mobile ne respectent pas la disposition demandée : ${JSON.stringify(mobilePlanningAction)}`);

await evaluate("document.querySelector('.planning-leave-mobile').click()");
await waitFor("document.querySelector('.request-choice')");
await evaluate("document.querySelectorAll('.request-choice .choice-grid button')[1].click()");
await waitFor("document.querySelector('#recovery-type-choice-title')");
const recoveryEntryTypes = await evaluate("[...document.querySelectorAll('.recovery-type-choice-grid strong')].map(node => node.textContent.trim())");
for (const label of ["Récupération en journée", "Récupération en demi-journée", "Récupération en heures", "Récupération jour férié"])
  if (!recoveryEntryTypes.includes(label)) throw new Error(`Type de récupération absent du point d’entrée : ${label}`);
await evaluate("document.querySelector('.recovery-type-choice-grid button').click()");
await waitFor("document.querySelector('#planning-leave-method-title')");
await evaluate("document.querySelector('#planning-leave-method-title').closest('.modal-card').querySelector('.choice-grid button').click()");
await waitFor("document.querySelector('#request-panel')");
if (await evaluate("Boolean(document.querySelector('.warning-modal .warning-button'))"))
  await evaluate("document.querySelector('.warning-modal .warning-button').click()");
const recoveryFormTypes = await evaluate("[...document.querySelectorAll('#request-panel .type-tabs button')].map(node => node.textContent.trim())");
for (const label of ["Récupération en journée", "Récupération en demi-journée", "Récupération en heures", "Récupération jour férié"])
  if (!recoveryFormTypes.includes(label)) throw new Error(`Type de récupération absent : ${label}`);
if (await evaluate("Boolean(document.querySelector('#recovery-path-title, #recovery-use-title'))"))
  throw new Error("Le parcours ouvre encore la saisie simplifiée au lieu du formulaire complet.");
await evaluate("document.querySelector('#request-panel .request-heading .danger').click()");

await evaluate("document.querySelector('.day').click()");
await waitFor("document.querySelector('#day-title')");
const dayActions = await evaluate("[...document.querySelectorAll('.leave-choices button')].map(node => node.textContent.trim())");
if (!dayActions.some((label) => label.includes('Récupération')))
  throw new Error("La récupération n’est pas proposée depuis une case du planning.");
await evaluate("[...document.querySelectorAll('.leave-choices button')].find(node => node.textContent.includes('Récupération')).click()");
await waitFor("document.querySelector('#recovery-type-choice-title')");
await evaluate("document.querySelectorAll('.recovery-type-choice-grid button')[1].click()");
await waitFor("document.querySelector('#planning-leave-method-title')");
await evaluate("document.querySelector('#planning-leave-method-title').closest('.modal-card').querySelectorAll('.choice-grid button')[1].click()");
await waitFor("document.querySelector('#recovery-use-title')");
const manualRecoveryTypes = await evaluate("[...document.querySelectorAll('.recovery-duration-choice button')].map(node => node.textContent.trim())");
for (const label of ["Durée libre", "Demi-journée", "Journée", "Jour férié"])
  if (!manualRecoveryTypes.some((entry) => entry.includes(label)))
    throw new Error(`Type de récupération manuelle absent : ${label}`);
await evaluate("document.querySelector('#recovery-use-title').closest('.modal-card').querySelector('.modal-close').click()");

await evaluate("document.querySelector('.planning-leave-mobile').click()");
await waitFor("document.querySelector('.request-choice')");
await evaluate("document.querySelector('.request-choice .choice-grid button').click()");
await waitFor("document.querySelector('#planning-leave-method-title')");
const planningMethods = await evaluate("[...document.querySelectorAll('#planning-leave-method-title + .choice-grid strong')].map(node => node.textContent)");
if (!planningMethods.includes('Remplir le formulaire') || !planningMethods.includes('Ajouter manuellement au planning'))
  throw new Error("Les deux méthodes réservées au planning ne sont pas proposées.");
await evaluate("document.querySelector('#planning-leave-method-title').closest('.modal-card').querySelector('.modal-close').click()");

await evaluate("document.querySelector('.main-menu-button').click()");
await waitFor("document.querySelector('.main-menu-drawer')");
const menuLabels = await evaluate("[...document.querySelectorAll('.main-menu-drawer nav strong')].map((node) => node.textContent)");
for (const label of ["Accueil", "Congés et récupérations", "Ma paie", "Télécharger les plannings en PDF"])
  if (!menuLabels.includes(label)) throw new Error(`Entrée de menu absente : ${label}`);
const guideMenuAvailable = await evaluate("[...document.querySelectorAll('.main-menu-secondary button')].some(node => node.textContent.includes('Mode d’emploi'))");
if (!guideMenuAvailable) throw new Error("Le mode d’emploi n’est pas resté accessible dans le menu.");
await evaluate("[...document.querySelectorAll('.main-menu-secondary button')].find(node => node.textContent.includes('Mode d’emploi')).click()");
await waitFor("document.querySelector('.guide-modal')");
const guideContent = await evaluate(`(() => ({
  tocItems: document.querySelectorAll('.guide-toc button').length,
  hasValidatedLeaveAdvice: document.querySelector('.guide-modal').textContent.includes('congés validés'),
  hasPayslipAdvice: document.querySelector('.guide-modal').textContent.includes('plusieurs bulletins'),
  hasPdfHelp: document.querySelector('.guide-modal').textContent.includes('Télécharger les plannings en PDF')
}))()`);
if (guideContent.tocItems !== 8 || !guideContent.hasValidatedLeaveAdvice || !guideContent.hasPayslipAdvice || !guideContent.hasPdfHelp)
  throw new Error(`Le mode d’emploi est incomplet : ${JSON.stringify(guideContent)}`);
const guideCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-guide-mobile.png", Buffer.from(guideCapture.data, "base64"));
await evaluate("document.querySelectorAll('.guide-toc button')[7].click()");
await new Promise((resolve) => setTimeout(resolve, 450));
const guideTocScrolls = await evaluate("document.querySelector('.guide-modal').scrollTop > 100");
if (!guideTocScrolls) throw new Error("La table des matières du mode d’emploi ne navigue pas dans le contenu.");
await evaluate("document.querySelector('.guide-modal .modal-close').click()");
await evaluate("document.querySelector('.main-menu-button').click()");
await waitFor("document.querySelector('.main-menu-drawer')");
await evaluate("[...document.querySelectorAll('.main-menu-drawer nav button')].find((node) => node.textContent.includes('Congés et récupérations')).click()");
await waitFor("document.querySelector('.leave-intro')");
const leaveYearAvailable = await evaluate("Boolean(document.querySelector('[aria-label=\"Choisir l’année des absences\"]'))");
if (!leaveYearAvailable) throw new Error("Le choix de l’année des absences est absent.");
await evaluate("document.querySelector('.manual-adjustments-trigger').click()");
await waitFor("document.querySelector('.manual-adjustments-modal')");
await new Promise((resolve) => setTimeout(resolve, 250));
const manualAdjustmentsUi = await evaluate(`(() => ({
  leaveInputs: document.querySelectorAll('.manual-leave-inputs input').length,
  sundayInputs: document.querySelectorAll('.manual-sunday-inputs input').length,
  periods: [...document.querySelectorAll('.manual-sunday-period')].map(node => node.textContent),
  width: document.querySelector('.manual-adjustments-modal').getBoundingClientRect().width,
  viewport: document.documentElement.clientWidth,
  sectionsSeparated: (() => {
    const sections = [...document.querySelectorAll('.manual-adjustment-section')].map(node => node.getBoundingClientRect());
    return sections.length === 2 && sections[0].bottom <= sections[1].top;
  })()
}))()`);
if (manualAdjustmentsUi.leaveInputs !== 3 || manualAdjustmentsUi.sundayInputs !== 4 || manualAdjustmentsUi.width > manualAdjustmentsUi.viewport || !manualAdjustmentsUi.sectionsSeparated)
  throw new Error(`Le rattrapage annuel n’est pas utilisable sur mobile : ${JSON.stringify(manualAdjustmentsUi)}`);
const manualAdjustmentsCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-manual-adjustments-mobile.png", Buffer.from(manualAdjustmentsCapture.data, "base64"));
await evaluate("document.querySelector('.manual-adjustments-modal .modal-close').click()");
const mecenatActions = await evaluate(`(() => {
  const card = document.querySelector('.mecenat-balance-card');
  const declare = card.querySelector('.mecenat-action').getBoundingClientRect();
  const history = card.querySelector('.overtime-history-toggle').getBoundingClientRect();
  const overtimeCard = document.querySelector('.overtime-balance-card:not(.mecenat-balance-card)');
  const archive = document.querySelector('.leave-request-archive').getBoundingClientRect();
  const overtimeBounds = overtimeCard.getBoundingClientRect();
  const mecenatBounds = card.getBoundingClientRect();
  const overtimeDeclare = overtimeCard.querySelector('.overtime-actions .primary-action').getBoundingClientRect();
  const overtimeHistory = overtimeCard.querySelector('.overtime-history-toggle').getBoundingClientRect();
  return {
    stacked: history.top > declare.bottom,
    fullWidth: Math.abs(declare.width - history.width) < 2,
    sameOrderAsOvertime: overtimeHistory.top > overtimeDeclare.bottom,
    archiveGap: overtimeBounds.top - archive.bottom,
    sectionGap: mecenatBounds.top - overtimeBounds.bottom,
    overtimePadding: parseFloat(getComputedStyle(overtimeCard).paddingTop)
  };
})()`);
if (!mecenatActions.stacked || !mecenatActions.fullWidth || !mecenatActions.sameOrderAsOvertime || mecenatActions.archiveGap < 17 || mecenatActions.sectionGap < 15 || mecenatActions.overtimePadding < 16)
  throw new Error("Les actions Mécénat ne reprennent pas la disposition des heures supplémentaires.");
await evaluate("document.querySelector('.solidarity-hours-action').click()");
await waitFor("document.querySelector('.solidarity-hours-modal')");
const solidarityForm = await evaluate(`(() => {
  const fields = document.querySelectorAll('.solidarity-hours-modal input');
  return { visible: Boolean(document.querySelector('.solidarity-hours-modal')), fields: fields.length };
})()`);
if (!solidarityForm.visible || solidarityForm.fields !== 2)
  throw new Error("La saisie manuelle des heures de solidarité n’est pas utilisable sur téléphone.");
await evaluate("document.querySelector('.solidarity-hours-modal .modal-close').click()");
await evaluate("document.querySelector('.overtime-balance-card:not(.mecenat-balance-card) .overtime-actions .primary-action').click()");
await waitFor("document.querySelector('.overtime-modal')");
const overtimeForm = await evaluate(`({
  timeInputs: document.querySelectorAll('.overtime-modal input[type="time"]').length,
  hasDurationChoice: document.querySelector('.overtime-modal').textContent.includes('Nombre d’heures'),
  hasScheduleTitle: document.querySelector('.overtime-modal').textContent.includes('Horaires')
})`);
if (overtimeForm.timeInputs !== 2 || overtimeForm.hasDurationChoice || !overtimeForm.hasScheduleTitle)
  throw new Error(`La déclaration d’heures supplémentaires n’est pas limitée aux horaires : ${JSON.stringify(overtimeForm)}`);
await evaluate("document.querySelector('.overtime-modal .modal-close').click()");
const leaveCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-leave-mobile.png", Buffer.from(leaveCapture.data, "base64"));
await evaluate("document.querySelector('.main-menu-button').click()");
await evaluate("[...document.querySelectorAll('.main-menu-drawer nav button')].find((node) => node.textContent.includes('Congés et récupérations')).click()");
await waitFor("document.querySelector('.mecenat-balance-card')");
await evaluate("document.querySelector('.manual-adjustments-trigger').click()");
await waitFor("document.querySelector('.manual-adjustments-modal')");
await new Promise((resolve) => setTimeout(resolve, 250));
const manualDesktopCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-manual-adjustments-desktop.png", Buffer.from(manualDesktopCapture.data, "base64"));
await evaluate("document.querySelector('.manual-adjustments-modal .modal-close').click()");
const desktopMecenatActions = await evaluate(`(() => {
  const overtimeCard = document.querySelector('.overtime-balance-card:not(.mecenat-balance-card)');
  const mecenatCard = document.querySelector('.mecenat-balance-card');
  const overtimeAction = overtimeCard.querySelector('.primary-action').getBoundingClientRect();
  const overtimeHistory = overtimeCard.querySelector('.overtime-history-toggle').getBoundingClientRect();
  const mecenatAction = mecenatCard.querySelector('.mecenat-action').getBoundingClientRect();
  const mecenatHistory = mecenatCard.querySelector('.overtime-history-toggle').getBoundingClientRect();
  const card = mecenatCard.getBoundingClientRect();
  return {
    actionsLeftAligned: Math.abs(overtimeAction.left - mecenatAction.left) < 2,
    historiesLeftAligned: Math.abs(overtimeHistory.left - mecenatHistory.left) < 2,
    sameActionWidth: Math.abs(overtimeAction.width - mecenatAction.width) < 2,
    sameHistoryWidth: Math.abs(overtimeHistory.width - mecenatHistory.width) < 2,
    widths: { card: card.width, overtimeAction: overtimeAction.width, mecenatAction: mecenatAction.width, overtimeHistory: overtimeHistory.width, mecenatHistory: mecenatHistory.width }
  };
})()`);
if (!desktopMecenatActions.actionsLeftAligned || !desktopMecenatActions.historiesLeftAligned || !desktopMecenatActions.sameActionWidth || !desktopMecenatActions.sameHistoryWidth)
  throw new Error(`Les actions Mécénat ne reprennent pas le schéma des heures supplémentaires sur ordinateur : ${JSON.stringify(desktopMecenatActions)}`);
const leaveDesktopCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-leave-desktop.png", Buffer.from(leaveDesktopCapture.data, "base64"));
await evaluate("document.querySelector('.main-menu-button').click()");
await evaluate("[...document.querySelectorAll('.main-menu-drawer nav button')].find((node) => node.textContent.includes('Ma paie')).click()");
await waitFor("document.querySelector('.pay-category-grid')");
const profileInitiallyCollapsed = await evaluate("!document.querySelector('.pay-profile-settings-grid') && document.querySelector('.pay-profile-summary').getAttribute('aria-expanded') === 'false'");
if (!profileInitiallyCollapsed) throw new Error("Le profil de paie n’est pas replié par défaut.");
await evaluate("document.querySelector('.pay-profile-summary').click()");
await waitFor("document.querySelector('.pay-profile-settings-grid')");
const paySettings = await evaluate(`({
  quota: Boolean(document.querySelector('.pay-profile-settings [aria-label="Choisir la quotité de travail"]')),
  status: Boolean(document.querySelector('.pay-profile-settings [aria-label="Choisir le statut"]')),
  accountQuota: Boolean(document.querySelector('.account-quota-setting')),
  mobileWidths: [...document.querySelectorAll('.pay-profile-settings-grid > label .choice-picker-trigger')].map(node => node.getBoundingClientRect().width),
  profileState: document.querySelector('.pay-profile-completeness')?.textContent,
  scrollHint: document.querySelector('.pay-profile-scroll-hint')?.textContent
})`);
if (!paySettings.quota || !paySettings.status || paySettings.accountQuota || Math.abs(paySettings.mobileWidths[0] - paySettings.mobileWidths[1]) > 1 || ![undefined, 'Profil complet'].includes(paySettings.profileState) || paySettings.scrollHint !== 'Faire défiler')
  throw new Error("La configuration générale de paie n’est pas centralisée sur son accueil.");
const payOverviewCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-pay-mobile.png", Buffer.from(payOverviewCapture.data, "base64"));
await evaluate("document.querySelector('.pay-category-grid button').click()");
await waitFor("document.querySelector('.native-back-button') && document.querySelector('.pay-period-toggle')");
const payCategoryHeader = await evaluate(`({
  title: document.querySelector('.pay-detail-sticky-header h2')?.textContent,
  position: getComputedStyle(document.querySelector('.pay-detail-sticky-header')).position,
  close: Boolean(document.querySelector('.pay-detail-close')),
  today: Boolean(document.querySelector('.variable-pay-card .pay-today-button')),
  month: document.querySelector('.pay-detail-title-button small')?.textContent
})`);
if (payCategoryHeader.title !== 'Primes et jours fériés' || payCategoryHeader.position !== 'sticky' || !payCategoryHeader.close || !payCategoryHeader.today || !payCategoryHeader.month)
  throw new Error(`L’en-tête de catégorie de paie n’est pas persistant ou complet : ${JSON.stringify(payCategoryHeader)}`);
await evaluate("document.querySelector('.pay-detail-title-button').click()");
await waitFor("document.querySelector('.pay-category-grid')");
await evaluate("document.querySelector('.pay-category-grid button').click()");
await waitFor("document.querySelector('.pay-period-toggle')");
const periodInitiallyCollapsed = await evaluate("!document.querySelector('.variable-pay-list') && document.querySelector('.variable-pay-card > header').getAttribute('aria-expanded') === 'false'");
if (!periodInitiallyCollapsed) throw new Error("La période de paie n’est pas repliée par défaut.");
await evaluate("document.querySelector('.variable-pay-card > header').click()");
await waitFor("document.querySelector('.variable-pay-list')");
const pendingHolidayPicker = await evaluate("Boolean(document.querySelector('.holiday-pay-picker .choice-picker-trigger'))");
if (pendingHolidayPicker) {
  await evaluate("document.querySelector('.holiday-pay-picker .choice-picker-trigger').scrollIntoView({block:'center'})");
  await new Promise((resolve) => setTimeout(resolve, 500));
  await evaluate("document.querySelector('.holiday-pay-picker .choice-picker-trigger').click()");
  await waitFor("document.querySelector('.holiday-pay-picker .choice-picker-menu')");
  const holidayMenu = await evaluate(`(() => {
    const menu = document.querySelector('.holiday-pay-picker .choice-picker-menu');
    const bounds = menu.getBoundingClientRect();
    return { options: menu.querySelectorAll('button').length, top: bounds.top, bottom: bounds.bottom, viewport: innerHeight };
  })()`);
  if (holidayMenu.options !== 2 || holidayMenu.top < 0 || holidayMenu.bottom > holidayMenu.viewport)
    throw new Error(`Le choix de compensation est encore coupé sur mobile : ${JSON.stringify(holidayMenu)}`);
  await evaluate("document.querySelector('.holiday-pay-picker .choice-picker-trigger').click()");
}
const allowanceMonthBefore = await evaluate("document.querySelector('#variable-pay-title').textContent");
await evaluate("document.querySelector('.variable-pay-card [aria-label=\"Mois suivant\"]').click()");
await new Promise((resolve) => setTimeout(resolve, 150));
const allowanceMonthAfter = await evaluate("document.querySelector('#variable-pay-title').textContent");
if (allowanceMonthBefore === allowanceMonthAfter) throw new Error("La flèche de mois des primes ne change pas la période.");
await evaluate("document.querySelector('.variable-pay-card [aria-label=\"Mois précédent\"]').click()");
await new Promise((resolve) => setTimeout(resolve, 150));
const payDetailCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-pay-detail-mobile.png", Buffer.from(payDetailCapture.data, "base64"));
await evaluate("document.querySelector('.native-back-button').click()");
await waitFor("document.querySelector('.pay-category-grid')");
await evaluate("document.querySelectorAll('.pay-category-grid button')[1].click()");
await waitFor("document.querySelector('.pay-detail-month-heading')");
const payslipLabels = await evaluate(`({
  detail: document.querySelector('.pay-detail-month-heading')?.textContent,
  verify: document.querySelector('.payslip-verify-card')?.textContent,
  calibrate: document.querySelector('.payslip-calibration-card')?.textContent,
  hasReadResult: document.body.innerText.includes('Lire le résultat'),
  hasOldEstimate: document.body.innerText.includes('Mon estimation')
})`);
if (!payslipLabels.detail.includes('Détail de la paie du mois affiché') ||
    !payslipLabels.verify.includes('Pour voir si rien ne manque') ||
    !payslipLabels.calibrate.includes('Pour remplir automatiquement les éléments de paie') ||
    payslipLabels.hasReadResult || payslipLabels.hasOldEstimate)
  throw new Error("L’écran Bulletins et estimations conserve un ancien libellé ou manque une explication.");
const payDetailMonthBefore = await evaluate("document.querySelector('.pay-detail-month-heading strong').textContent");
await evaluate("document.querySelector('.pay-detail-month-heading [aria-label=\"Mois suivant\"]').click()");
await new Promise((resolve) => setTimeout(resolve, 150));
const payDetailMonthAfter = await evaluate("document.querySelector('.pay-detail-month-heading strong').textContent");
if (payDetailMonthBefore === payDetailMonthAfter) throw new Error("La flèche du détail de paie ne change pas le mois.");
await evaluate("document.querySelector('.pay-detail-month-heading [aria-label=\"Mois précédent\"]').click()");
await new Promise((resolve) => setTimeout(resolve, 150));
const swipeResult = await evaluate(`(async () => {
  const element = document.querySelector('.pay-dedicated-content');
  const before = document.querySelector('.pay-detail-month-heading strong').textContent;
  const start = new Touch({ identifier: 7, target: element, clientX: 320, clientY: 360 });
  const end = new Touch({ identifier: 7, target: element, clientX: 90, clientY: 365 });
  element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, changedTouches: [start], touches: [start] }));
  element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end], touches: [] }));
  await new Promise((resolve) => setTimeout(resolve, 420));
  return { before, after: document.querySelector('.pay-detail-month-heading strong').textContent };
})()`);
if (swipeResult.before === swipeResult.after) throw new Error("Le swipe du détail de paie ne change pas le mois.");
await evaluate("document.querySelector('.pay-detail-month-heading [aria-label=\"Mois précédent\"]').click()");
await new Promise((resolve) => setTimeout(resolve, 150));
await evaluate("document.querySelector('.native-back-button').click()");
await waitFor("document.querySelector('.pay-category-grid')");
await evaluate("document.querySelector('.main-menu-button').click()");
await evaluate("[...document.querySelectorAll('.main-menu-drawer nav button')].find((node) => node.textContent.includes('Accueil')).click()");
await waitFor("document.querySelector('.today-overview')");

const stickyHeader = await evaluate(`(async () => {
  window.scrollTo(0, 900);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const menu = document.querySelector('.main-menu-button').getBoundingClientRect();
  const header = getComputedStyle(document.querySelector('.top-header'));
  window.scrollTo(0, 0);
  return { menuTop: menu.top, position: header.position };
})()`);
if (stickyHeader.position !== "sticky" || stickyHeader.menuTop < 0)
  throw new Error("Le menu principal n’est pas accessible après défilement.");

await evaluate("document.querySelector('.today-group-card').click()");
await waitFor("document.querySelector('.group-choice-grid')");
await evaluate("[...document.querySelectorAll('.group-choice-grid button')].find((node) => node.textContent.includes('3')).click()");
await waitFor("document.querySelector('.today-group-card').textContent.includes('Groupe 3')");

await evaluate("document.querySelector('.main-menu-button').click()");
await evaluate("[...document.querySelectorAll('.main-menu-drawer nav button')].find((node) => node.textContent.includes('Télécharger')).click()");
await waitFor("document.querySelector('.pdf-download-screen')");
const pdfCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-pdf-mobile.png", Buffer.from(pdfCapture.data, "base64"));
const pdfScreen = await evaluate(`({
  vacationOption: document.querySelector('.pdf-download-screen .school-vacation-toggle')?.textContent.trim(),
  actions: document.querySelectorAll('.pdf-download-actions .pdf-action').length,
  legacyExportVisible: Boolean(document.querySelector('.annual-pdf-actions')),
  zonePicker: Boolean(document.querySelector('.school-vacation-zone-picker'))
})`);
await evaluate("document.querySelector('.pdf-download-screen .school-vacation-toggle').click()");
const allZonesCopy = await evaluate("document.querySelector('.pdf-download-screen .school-vacation-choice').textContent.includes('zones A, B et C')");
if (pdfScreen.actions !== 3 || pdfScreen.legacyExportVisible || pdfScreen.zonePicker || !allZonesCopy)
  throw new Error("La rubrique PDF dédiée n’est pas correctement isolée.");
await evaluate("document.querySelector('.main-menu-button').click()");
await evaluate("[...document.querySelectorAll('.main-menu-drawer nav button')].find((node) => node.textContent.includes('Accueil')).click()");
await waitFor("document.querySelector('.today-overview')");

const capture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-home-mobile.png", Buffer.from(capture.data, "base64"));

await viewport(1280, 900);
await new Promise((resolve) => setTimeout(resolve, 150));
const desktop = await evaluate("({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })");
if (desktop.scrollWidth > desktop.width) throw new Error(`Débordement ordinateur : ${desktop.scrollWidth}px pour ${desktop.width}px`);
const desktopPlanningAction = await evaluate(`(() => ({
  mobileVisible: getComputedStyle(document.querySelector('.planning-leave-mobile')).display !== 'none',
  desktopVisible: getComputedStyle(document.querySelector('.planning-leave-desktop')).display !== 'none',
  equalPlanningInfoWidths: (() => {
    const widths = [...document.querySelectorAll('.controls > .year-choice, .controls > .worked-days')].map(node => node.getBoundingClientRect().width);
    return widths.length === 3 && widths.every(width => Math.abs(width - widths[0]) < 2);
  })(),
  equalPlanningTriggerWidths: (() => {
    const widths = [
      document.querySelector('.planning-year-choice .year-stepper'),
      document.querySelector('.planning-group-choice .year-stepper'),
      document.querySelector('.worked-days-stepper')
    ].map(node => node.getBoundingClientRect().width);
    return widths.every(width => Math.abs(width - widths[0]) < 2);
  })(),
  equalToolbarWidths: (() => {
    const nodes = [
      ...document.querySelectorAll('.month-toolbar .period-navigation > .choice-picker'),
      document.querySelector('.month-toolbar .today-button'),
      document.querySelector('.month-toolbar .planning-leave-desktop')
    ].filter(Boolean);
    const widths = nodes.map(node => node.getBoundingClientRect().width);
    return widths.length === 4 && widths.every(width => Math.abs(width - widths[0]) < 2);
  })()
}))()`);
if (desktopPlanningAction.mobileVisible || !desktopPlanningAction.desktopVisible || !desktopPlanningAction.equalPlanningInfoWidths || !desktopPlanningAction.equalPlanningTriggerWidths || !desktopPlanningAction.equalToolbarWidths)
  throw new Error(`Les commandes du planning ordinateur ne sont pas équilibrées : ${JSON.stringify(desktopPlanningAction)}`);
await evaluate("[...document.querySelectorAll('.view-switch button')].find(node => node.textContent.includes('Année')).click()");
await waitFor("document.querySelector('.annual-toolbar .planning-leave-annual')");
const annualLeaveAction = await evaluate(`(() => {
  const toolbar = document.querySelector('.annual-toolbar').getBoundingClientRect();
  const button = document.querySelector('.annual-toolbar .planning-leave-annual').getBoundingClientRect();
  return { fullWidth: button.width > toolbar.width - 32, below: button.top > toolbar.top + 45 };
})()`);
if (!annualLeaveAction.fullWidth || !annualLeaveAction.below)
  throw new Error(`Le bouton de la vue annuelle n’occupe pas toute sa ligne : ${JSON.stringify(annualLeaveAction)}`);
await evaluate("[...document.querySelectorAll('.view-switch button')].find(node => node.textContent.includes('Mois')).click()");
await waitFor("document.querySelector('.month-toolbar')");
await evaluate("document.querySelector('.main-menu-button').click()");
await evaluate("[...document.querySelectorAll('.main-menu-drawer nav button')].find((node) => node.textContent.includes('Ma paie')).click()");
await waitFor("document.querySelector('.pay-profile-settings-grid')");
const payCategoryOutlines = await evaluate(`[...document.querySelectorAll('.pay-category-grid > button')].every(node => {
  const style = getComputedStyle(node);
  return parseFloat(style.borderTopWidth) === 1 && style.borderTopStyle === 'solid' && style.borderTopColor !== 'rgba(0, 0, 0, 0)';
})`);
if (!payCategoryOutlines) throw new Error("Les catégories de paie n’ont pas leur liseré.");
const desktopPayAlignment = await evaluate(`(() => {
  const labels = [...document.querySelectorAll('.pay-profile-settings-grid > label')].map(node => node.getBoundingClientRect());
  const triggers = [...document.querySelectorAll('.pay-profile-settings-grid .choice-picker-trigger')].map(node => node.getBoundingClientRect());
  return {
    sameTop: Math.abs(labels[0].top - labels[1].top) < 1,
    sameHeight: Math.abs(labels[0].height - labels[1].height) < 1,
    sameTriggerSize: Math.abs(triggers[0].width - triggers[1].width) < 1 && Math.abs(triggers[0].height - triggers[1].height) < 1
  };
})()`);
if (!desktopPayAlignment.sameTop || !desktopPayAlignment.sameHeight || !desktopPayAlignment.sameTriggerSize)
  throw new Error("Quotité et Statut ne sont pas parfaitement alignés sur ordinateur.");
await evaluate("document.querySelector('.main-menu-button').click()");
await evaluate("[...document.querySelectorAll('.main-menu-drawer nav button')].find((node) => node.textContent.includes('Accueil')).click()");
await waitFor("document.querySelector('.today-overview')");

// Parcours complet du formulaire en mode démo : sélection, formulaire,
// génération, sauvegarde, retour et mise à jour immédiate du planning.
await viewport(390, 844);
await evaluate("document.querySelector('.today-overview .add-action').click()");
await waitFor("document.querySelector('.request-choice')");
const leaveEntryChoices = await evaluate("[...document.querySelectorAll('.request-choice .choice-grid strong')].map(node => node.textContent.trim())");
if (!leaveEntryChoices.includes('Un arrêt maladie'))
  throw new Error("Le point d’entrée universel ne propose pas l’arrêt maladie.");
await evaluate("[...document.querySelectorAll('.request-choice .choice-grid button')].find(node => node.textContent.includes('arrêt maladie')).click()");
await waitFor("document.querySelector('.sick-request-options')");
const sickRequest = await evaluate(`({
  activeLabel: document.querySelector('.sick-request-options .type-tabs button')?.textContent.trim(),
  professionalSickOption: [...document.querySelectorAll('.request-option-group')].some(node => node.textContent.includes('Autres congés') && node.textContent.includes('Maladie'))
})`);
if (!sickRequest.activeLabel?.includes('Maladie') || sickRequest.professionalSickOption)
  throw new Error(`Le parcours maladie n’est pas distinct du congé professionnel : ${JSON.stringify(sickRequest)}`);
await evaluate("document.querySelector('#request-panel .request-heading .danger').click()");
await evaluate("document.querySelector('.today-overview .add-action').click()");
await waitFor("document.querySelector('.request-choice')");
await evaluate("document.querySelector('.request-choice .choice-grid button').click()");
await waitFor("document.querySelector('#request-panel')");
const selectedDate = await evaluate(`(() => {
  const day = document.querySelector('.month-card .day.work, .month-card .day.training');
  if (!day) return '';
  day.click();
  return day.getAttribute('aria-label');
})()`);
if (!selectedDate) throw new Error("Aucune journée n'a pu être sélectionnée pour le formulaire.");
await waitFor("document.querySelector('.request-selected')");
await evaluate("document.querySelector('#request-panel .validate-button').click()");
await waitFor("location.pathname.includes('/formulaire/index.html')", 10000);
await waitFor("document.querySelector('#btnPdf') && document.body.innerText.includes('Demande integree')", 10000);
await evaluate("document.querySelector('#btnPdf').click()");
await waitFor("location.pathname === '/' && new URLSearchParams(location.search).get('request') === 'saved'", 20000);
await waitFor("document.querySelector('.leave-day, .half-morning, .half-afternoon')", 10000);
const requestFlow = await evaluate(`({
  confirmation: document.body.innerText.includes('planning et les soldes sont à jour'),
  markedLeave: Boolean(document.querySelector('.leave-day, .half-morning, .half-afternoon'))
})`);
if (!requestFlow.markedLeave) throw new Error("Le congé finalisé n'apparaît pas dans le planning de démo.");

// Fixture visuelle éphémère : elle n'écrit aucune donnée et sert uniquement à
// vérifier les superpositions CSS des quatre représentations demandées.
await evaluate(`(() => {
  const days = [...document.querySelectorAll('.month-card .day.work')].slice(0, 5);
  const marker = (day, className, text, markerClass) => {
    day.classList.add('leave-day', className);
    const span = document.createElement('span');
    span.className = 'leave-calendar-marker ' + markerClass;
    span.textContent = text;
    day.append(span);
  };
  marker(days[0], 'leave-exceptional', 'ASA', 'leave-calendar-marker-exceptional');
  marker(days[1], 'leave-childcare', '👶', 'leave-calendar-marker-childcare');
  marker(days[4], 'leave-sick', '🤒', 'leave-calendar-marker-sick');
  days[2].classList.add('half-morning');
  const note = document.createElement('span');
  note.className = 'note-band note-band-half-morning';
  note.textContent = '✎';
  days[2].append(note);
  days[3].classList.add('half-afternoon');
  document.querySelector('.success-toast button')?.click();
  const card = document.querySelector('.month-card');
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 145);
})()`);
await new Promise((resolve) => setTimeout(resolve, 100));
const calendarMobileCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-calendar-mobile.png", Buffer.from(calendarMobileCapture.data, "base64"));
await viewport(1280, 900);
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate("document.querySelector('.month-card').scrollIntoView({ block: 'center' })");
const calendarDesktopCapture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("qa-calendar-desktop.png", Buffer.from(calendarDesktopCapture.data, "base64"));

console.log(JSON.stringify({ guidePrompt, guideContent, guideTocScrolls, mobile, mobilePlanningAction, manualAdjustmentsUi, desktop, desktopPlanningAction, annualLeaveAction, desktopMecenatActions, paySettings, desktopPayAlignment, mecenatActions, solidarityForm, overtimeForm, recoveryFormTypes, payCategoryHeader, payslipLabels, swipeResult, planningMethods, menuLabels, stickyHeader, pdfScreen, leaveEntryChoices, sickRequest, requestFlow }, null, 2));
await send("Target.closeTarget", { targetId: target.targetId });
socket.close();
