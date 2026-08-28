# Carte rapide du projet

Cette carte sert à trouver le bon fichier sans relire toute l'application.

## Point d'entrée

- `src/main.tsx` : montage React, import des styles, enregistrement et mise à
  jour du service worker.
- `src/App.tsx` : orchestration générale, état partagé et écrans qui n'ont pas
  encore été extraits. Rechercher la fonctionnalité avant d'ouvrir une plage.
- `src/styles.css` : styles globaux historiques. Rechercher la classe exacte ;
  les règles les plus tardives ont souvent priorité.

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
- `src/UserGuideDialogs.tsx` : mode d’emploi chargé uniquement lorsqu’il est
  ouvert.
- `src/UsefulFormsSection.tsx` : dossiers de formulaires et information tickets repas.
- `src/UsefulContactsSection.tsx` : annuaires Pompidou et GP-RMN, appels et e-mails directs.
- `src/GrandPalaisProgramSection.tsx` et `src/grandPalaisProgram.css` :
  programmation GP chargée à la demande, navigation par espace et périodes
  d’inter expos.

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
- `netlify/functions/calendar.mts` : API principale.
- `netlify/tests/calendar.function.test.ts` : tests directs d’authentification,
  d’isolation et d’écriture de l’API calendrier.
- `netlify/lib/` : validation, stockage par utilisatrice et sauvegardes.
- `public/formulaire/index.html` : formulaire autonome de demande.

## PDF et PWA

- `src/useAnnualPdfExport.ts` : chargement différé de l'export PDF.
- `src/planningPdf.ts` : génération des documents.
- `public/sw.js` : cache hors ligne et activation des mises à jour.
- `public/manifest.webmanifest` : installation de la PWA.

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
npm run test:e2e
npm run check
npm run build
```

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
