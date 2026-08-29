# Carte rapide du projet

Cette carte sert à trouver le bon fichier sans relire toute l'application.

## Point d'entrée

- `src/main.tsx` : montage React, import des styles, enregistrement et mise à
  jour du service worker.
- `src/App.tsx` : orchestration générale, état partagé et écrans qui n'ont pas
  encore été extraits. Rechercher la fonctionnalité avant d'ouvrir une plage.
- `src/styles.css` : point d’entrée de la cascade CSS. Ses imports numérotés
  dans `src/styles/` conservent l’ordre historique ; rechercher la classe dans
  ces fichiers sans réordonner les passes. `src/styles/README.md` documente le
  découpage et les rares priorités `!important` encore nécessaires.

## Composants d'interface autonomes

- `src/CalendarCleanup.tsx` : panneau et boutons « Effacer plusieurs dates ou
  notes ».
- `src/LeaveBalancesSection.tsx` : cartes des soldes, choix de l'année et accès
  aux reprises manuelles.
- `src/CetSection.tsx` : configuration, simulation, opérations et historique du
  compte épargne-temps.
- `src/CetFormDialog.tsx` : saisie guidée des formulaires officiels d’ouverture,
  d’alimentation et d’indemnisation du CET.
- `src/PayEstimateDetails.tsx` : détail de la paie du mois, navigation,
  heures supplémentaires et mécénats.
- `src/WorkTimeDialogs.tsx` : saisie des heures supplémentaires, récupérations,
  mécénats et crédits manuels.
- `src/LeaveDialogs.tsx` : reprise des absences antérieures et sélection manuelle
  d'une période de congés.
- `src/PlanningView.tsx` : grille mensuelle et contenu de recherche des notes.
- `src/PlanningDialogs.tsx` : horaires, avertissements, confirmations et messages.
- `src/RequestValidationSummary.tsx` : contrôle des dates, types, horaires et
  impact juste avant la validation d’une demande.
- `src/ChoicePicker.tsx` : sélecteur réutilisable.
- `src/AuthScreen.tsx` : connexion Netlify Identity.
- `src/DataManagementDialog.tsx` et `src/dataManagement.css` : sauvegarde,
  import et suppression des données.
- `src/ConnectionStatus.tsx` : état de la synchronisation.
- `src/AppNavigation.tsx` : en-tête, compte et menu principal communs à tous
  les écrans.
- `src/AppDialogLayer.tsx` : assemblage des dialogues, messages, confirmations
  et panneaux de gestion qui restent pilotés par l’orchestrateur.
- `src/HomeDashboard.tsx` : tableau d’accueil « en un coup d’œil ».
- `src/PlanningCommandCenter.tsx` et `src/PlanningDayCell.tsx` : commandes du
  calendrier et rendu interactif d’une journée.
- `src/LeaveManagementPage.tsx` : composition de la page congés et
  récupérations.
- `src/PayPage.tsx`, `src/PayAllowancesSection.tsx` et
  `src/PayslipCheckSection.tsx` : navigation paie, primes et composition du
  contrôle du bulletin. Ce dernier délègue les blocs autonomes à
  `src/PayslipVerificationCard.tsx`, `src/PayslipCalibrationCard.tsx` et
  `src/PayslipSettingsSections.tsx` (résultat, calibration, arrêts et
  paramètres), sans changer la structure DOM attendue par les styles.
- `src/PdfDownloadPage.tsx` : page de téléchargement des documents.
- `src/UserGuideDialogs.tsx` : mode d’emploi chargé uniquement lorsqu’il est
  ouvert.
- `src/UsefulFormsSection.tsx` : dossiers de formulaires et information tickets repas.
- `src/UsefulContactsSection.tsx` : annuaires Pompidou et GP-RMN, appels et e-mails directs.
- `src/GrandPalaisProgramSection.tsx` et `src/grandPalaisProgram.css` :
  programmation GP chargée à la demande, navigation par espace et périodes
  d’inter expos.
- `src/appSections.ts` : point d’entrée statique des grandes pages afin que
  chaque rubrique soit prête dès l’affichage de l’application.
- `src/use*UiState.ts` et `src/useCalendarDataState.ts` : états spécialisés de
  l’authentification, du planning, de la paie, des heures, de la coque et des
  données synchronisées ; `App.tsx` conserve leur orchestration commune.
- `src/useWorkTimeActions.ts` : validations, écritures et suppressions des
  heures supplémentaires, récupérations et mécénats.
- `src/usePayActions.ts` : saisie du profil de paie, import et vérification des
  bulletins, reports de dimanches et calcul du brut mensuel.
- `src/useAuthenticationActions.ts` : connexion, invitation, réinitialisation
  du mot de passe et déconnexion, sans état métier dans `App.tsx`.
- `src/useAccountDataActions.ts` : export, restauration, archivage et
  effacement sécurisé des données du compte.
- `src/usePlanningEntryActions.ts` : mutations directes maladie, grève,
  souhait et divers, ainsi que construction testable des lots de suppression
  de notes, absences et récupérations.
- `src/usePlanningEditorActions.ts` : enregistrement d’une fiche jour, notes
  multi-dates et création, modification, restauration ou suppression des
  périodes ; les lots réseau principaux sont construits par des helpers purs.
- `src/usePlanningInteractionActions.ts` : ouverture des fiches, sélections
  jour/plage, préparation des demandes et navigation tactile du calendrier,
  sans rendu JSX dans l’orchestrateur.
- `src/usePlanningRequestActions.ts` : validation des demandes préparées,
  contrôle des soldes/capacités du formulaire, enregistrement direct des
  absences sans PDF et transfert typé vers le formulaire autonome.

## Logique métier

- `src/planningLogic.ts` : cycle des groupes, jours, dates, libellés, congés,
  dimanches et primes de jours fériés.
- `src/appModel.ts` : types principaux et petits utilitaires partagés.
- `src/overtime.ts` : heures supplémentaires et récupérations.
- `src/mecenat.ts` / `src/mecenatRegulation.ts` : calcul des mécénats.
- `src/payEstimate.ts` : disponibilité de l'estimation de paie.
- `src/payslip.ts` / `src/payslipReview.ts` : lecture et contrôle du bulletin.
- `src/leaveRequest.ts` : préparation des demandes de congés.
- `src/cet.ts` : barèmes Centre Pompidou, plafonds, éligibilité et calculs CET.
- `src/cetFormsPdf.ts` : génération différée des demandes CET à vérifier, signer et envoyer à la RH.
- `public/cet/` : fonds issus des formulaires CET officiels fournis, conservés
  à l’identique pour les PDF remplis par l’application.

## Données et serveur

- `src/calendarApi.ts` : client HTTP du planning.
- `netlify/functions/calendar.mts` : point d’entrée léger de l’API principale
  (authentification, lecture ou dispatch d’une écriture).
- `netlify/lib/calendarRead.mts` : chargement et tri des données du compte.
- `netlify/lib/calendar-actions/` : un gestionnaire indépendant par action
  d’écriture du calendrier ; `index.mts` contient le dispatch explicite.
- `netlify/lib/calendarShared.mts` : types, validations et utilitaires partagés
  par les gestionnaires du calendrier.
- `netlify/tests/calendar.function.test.ts` : tests directs d’authentification,
  d’isolation et d’écriture de l’API calendrier.
- `netlify/lib/` : validation, stockage par utilisatrice et sauvegardes.
- `public/formulaire/index.html`, `form.css`, `app.js`, `device.js` et
  `sheets.js` : structure, présentation, logique, adaptation mobile et modèles
  du formulaire autonome de demande.

## PDF et PWA

- `src/useAnnualPdfExport.ts` : chargement différé de l'export PDF.
- `src/planningPdf.ts` : génération des documents.
- `public/sw.js` : cache hors ligne et activation des mises à jour.
- `public/manifest.webmanifest` : installation de la PWA.
- `scripts/check-bundle-budget.mjs` : plafonds CI du JavaScript, du CSS et des
  deux animations de contrôle de paie afin d’éviter de réintroduire des médias
  trop lourds.

## Tests à choisir selon la demande

- Planning et groupes : `src/planningLogic.test.ts`.
- CET : `src/cet.test.ts` et `src/CetSection.test.tsx`.
- Formulaires CET : `src/cetFormsPdf.test.ts`.
- Paie : `src/payEstimate.test.ts`, `src/payslip.test.ts`,
  `src/payslipReview.test.ts`.
- Heures : `src/overtime.test.ts`.
- Mécénats : `src/mecenat.test.ts`.
- API et stockage : `src/calendarApi.test.ts`, `netlify/lib/*.test.ts`.
- PDF : `src/pdfSmoke.test.ts`.
- Sécurité du formulaire : `formSecurity.test.mjs`.
- Finitions demandées : `uiRefinement.test.mjs`.
- Composants extraits : tests `*.test.tsx` portant le même nom.
- Parcours réels dans Chromium : `e2e/app.spec.ts`, exécuté sur ordinateur et
  mobile avec Playwright.

## Commandes de validation

```text
npm test
npm run test:coverage
npm run test:e2e
npm run test:pdf:visual
npm run lint
npm run check
npm run build
npm run check:bundle
npm run check:css
```

`test:pdf:visual` produit deux PDF locaux ignorés par Git, avec et sans
vacances scolaires, afin de contrôler visuellement les exports annuels après
une modification de leur mise en page.

## Préparer un contexte court pour une IA

```text
npm run context:ai -- planning
npm run context:ai -- leave
npm run context:ai -- pay
npm run context:ai -- pwa
npm run context:ai -- form
```

Le fichier ciblé est créé dans `.ai-context/`. Ce dossier est ignoré par Git et
ne doit pas être envoyé en plus du projet complet : il remplace le gros contexte
pour une demande portant sur une seule rubrique.

La publication Netlify est une action séparée : ne pas la lancer sans demande
explicite.
