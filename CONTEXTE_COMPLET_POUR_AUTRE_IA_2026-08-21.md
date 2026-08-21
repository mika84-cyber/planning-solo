# Dossier de transmission — Planning Solo

Date de l’export : 22 août 2026<br>
Application de production : https://planning-solo.netlify.app<br>
But de ce document : permettre à une autre IA d’examiner le produit et le code, puis de donner un avis argumenté sans perdre le contexte fonctionnel.

## Message conseillé à donner à l’autre IA

> Analyse ce projet comme un produit personnel déjà utilisé au quotidien. Commence par résumer ce que tu comprends, puis relève les points forts, les risques de régression, les incohérences d’interface éventuelles et les améliorations que tu recommandes. Classe tes remarques par priorité. Ne modifie rien et ne publie rien sans mon accord explicite. Explique simplement les sujets non techniques, mais sois précis quand tu commentes le code.

## Utilisatrice et objectif

- L’application est conçue pour une seule utilisatrice.
- Elle sert à suivre un cycle de travail en groupes, les congés, récupérations, jours fériés, dimanches travaillés, heures supplémentaires, mécénats, notes et éléments de paie.
- L’usage principal est mobile, sous forme d’application web installable (PWA), avec une version PC également utilisable.
- L’application doit rester simple, lisible, esthétique et confortable sur petit écran.
- Les données sont privées et ne doivent jamais être ajoutées à un export destiné à une tierce personne.

## État technique actuel

- React 19 + TypeScript + Vite.
- Hébergement Netlify.
- Authentification Netlify Identity.
- Données applicatives enregistrées côté serveur dans Netlify Blobs, isolées par compte.
- Fonction serveur principale : `netlify/functions/calendar.mts`.
- Application installable grâce à `public/manifest.webmanifest` et `public/sw.js`.
- Formulaire de demande autonome dans `public/formulaire/index.html`.
- Génération des plannings PDF avec jsPDF dans `src/planningPdf.ts`.
- Dernière validation locale : 25 fichiers de tests unitaires, 222 tests
  réussis, plus 16 parcours Chromium réussis sur ordinateur et mobile.
- Commandes de validation : `npm test` puis `npm run test:e2e`.
- Commande de production : `npm run build`.

## Architecture utile

- `src/App.tsx` : orchestration principale, état partagé et écrans restant à extraire.
- `src/CalendarCleanup.tsx` : nettoyage de plusieurs dates ou notes.
- `src/LeaveBalancesSection.tsx` : cartes et commandes des soldes de congés.
- `src/PayEstimateDetails.tsx` : détail mensuel de la paie.
- `src/WorkTimeDialogs.tsx` : fenêtres d'heures supplémentaires, récupérations et mécénats.
- `src/LeaveDialogs.tsx` : reprises manuelles et sélection de périodes de congés.
- `src/PlanningView.tsx` : calendrier mensuel et recherche dans les notes.
- `src/PlanningDialogs.tsx` : fenêtres communes, avertissements et confirmations.
- `src/RequestValidationSummary.tsx` : résumé des dates et de leur impact avant
  validation d’une demande.
- `src/styles.css` : styles généraux et nombreuses finitions responsives.
- `src/planningLogic.ts` : règles de dates, cycle, groupes, types de congés et jours travaillés.
- `src/appModel.ts` : calculs et types du modèle applicatif.
- `src/overtime.ts`, `src/mecenat.ts`, `src/payEstimate.ts`, `src/payslip.ts` : calculs spécialisés.
- `src/calendarApi.ts` : échanges avec la fonction Netlify.
- `src/planningPdf.ts` : PDF annuel et légendes.
- `src/main.tsx` : démarrage React et mise à jour de la PWA.
- `public/sw.js` : cache hors ligne, activation immédiate des nouvelles versions et navigation sans cache.
- `public/formulaire/index.html` : formulaire complet avec génération PDF et bouton de retour vers l’application.
- `uiRefinement.test.mjs` : tests de non-régression des demandes d’interface récentes.
- `e2e/app.spec.ts` : parcours réels du menu, du guide, de la paie, des PDF,
  de Divers, du nettoyage et de la gestion d’un congé, en vue PC et mobile.

## Comportements fonctionnels importants

### Planning et groupes

- Affichage mensuel et annuel.
- Cycle de 21 jours organisé en trois groupes.
- La rubrique « Aujourd’hui » indique uniquement le groupe réellement présent avec l’utilisatrice.
- Si l’utilisatrice est en formation, aucun groupe de travail n’est annoncé.
- Le mercredi, un groupe en formation n’est pas affiché comme groupe travaillé.
- Le panneau « Jours travaillés » est contenu dans l’écran et s’ouvre au-dessus sur mobile pour éviter d’être rogné.

### Congés, récupérations et Divers

- Les congés professionnels et récupérations peuvent passer par le formulaire ou être ajoutés manuellement selon le parcours.
- « Divers » est un repère visuel sans effet sur la paie ni les soldes.
- Depuis une case du planning, « Divers » est enregistré directement sans proposer de formulaire.
- Depuis le choix général, « Divers » ouvre directement la sélection de dates dans le planning.
- Une case Divers est bleue, entourée d’un liseré noir et porte une punaise rouge inclinée en bas à droite.
- Le choix « Divers » possède une pastille bleue dans la fenêtre « Que souhaitez-vous poser ? ».
- Le choix précise les exemples : grève, décharge syndicale et fermeture exceptionnelle.
- Avant la validation, un résumé affiche les dates, leur type, les horaires
  éventuels et l’effet sur le solde ou la paie.
- Dans la fiche d’un congé existant, « Modifier » et « Annuler le congé » sont
  immédiatement visibles ; « Repasser en souhaité » n’est plus proposé.
- L’arrêt maladie est suivi séparément et ne diminue pas les droits à congés.
- Sa demande utilise une carte aérée dédiée : le choix Maladie et son
  explication ne se chevauchent plus sur téléphone.
- Les années proposées vont de 2026 à 2050 ; 2024 et 2025 ne sont plus affichées.

### Soldes

- Les cartes Congés annuels, RTT, fractionnement et les catégories suivies ouvrent une fenêtre de consultation.
- Cette fenêtre affiche systématiquement janvier à décembre, même si les mois sont vides.
- Les douze mois sont fermés par défaut et dépliables.
- Un mois vide affiche « Aucune date enregistrée ce mois-ci ».
- Un mois avec des dates affiche son total et permet d’ouvrir la fiche de chaque journée.
- Les jours saisis manuellement sans date restent résumés séparément.

### Nettoyage du planning

- « Aujourd’hui » et « Effacer plusieurs dates ou notes » sont côte à côte sur mobile.
- Le bouton d’effacement reprend le fond de « Aujourd’hui », avec un texte rouge.
- Son libellé tient sur une seule ligne grâce à une seconde colonne légèrement plus large.
- Dans le panneau de nettoyage, les absences sont proposées avant les notes et les deux boutons ont la même taille.

### Paie et jours fériés

- Après avoir choisi « Prime » ou « Prime + récup », seul le montant compact reste cliquable pour modifier le choix.
- Dans « Détail de la paie du mois affiché », les flèches sont alignées à droite et espacées.
- Les estimations dépendent du profil de paie et évitent d’afficher un brut trompeur si les données essentielles manquent.

### PDF

- Les tableaux « PLANNING » et « COULEURS » utilisent la même épaisseur de liseré.
- Ce comportement est identique avec ou sans vacances scolaires.
- La génération annuelle est pilotée par `src/planningPdf.ts` et `src/useAnnualPdfExport.ts`.

### Formulaire

- Le formulaire autonome se trouve sous `/formulaire/index.html`.
- Un bouton « Revenir à l’application » est visible en haut.
- Sur téléphone, ses actions sont réparties sur plusieurs rangées pour éviter les textes coupés.
- Le formulaire possède sa propre PWA et son propre moteur PDF.

### Mise à jour de l’application installée

- Le bouton « Vérifier les mises à jour » est placé dans l’en-tête, sous les
  commandes Mois, Année et menu.
- Un appui demande immédiatement une mise à jour du service worker puis recharge la page.
- En production, l’application contrôle également les mises à jour à l’ouverture, au retour au premier plan et toutes les quinze minutes.
- Le service worker utilise `skipWaiting`, `clients.claim` et une navigation réseau sans cache avant repli hors ligne.

## Historique condensé des demandes récentes

Les demandes ci-dessous ont toutes été intégrées dans l’état actuel du code :

1. Corriger le groupe affiché dans la rubrique « Aujourd’hui » selon travail et formation.
2. Ne plus afficher les « périodes enregistrées » après la saisie d’un congé.
3. Harmoniser les boutons d’effacement et revoir la suppression depuis les soldes.
4. Rendre la gestion des congés plus esthétique depuis leur fiche de journée.
5. Compacter les choix de prime de jours fériés.
6. Corriger le panneau rogné des jours travaillés.
7. Mettre « Aujourd’hui » et l’effacement multiple côte à côte.
8. Créer le repère Divers bleu avec punaise rouge inclinée.
9. Revoir l’espacement des flèches dans le détail de paie.
10. Harmoniser les liserés des tableaux PDF.
11. Ajouter directement Divers au planning, sans formulaire.
12. Colorer puis harmoniser le bouton d’effacement multiple avec « Aujourd’hui ».
13. Regrouper les soldes par mois, puis afficher les douze mois fermés par défaut.
14. Ajouter un retour vers l’application dans le formulaire.
15. Ajouter une pastille bleue devant Divers.
16. Renforcer la mise à jour automatique de la PWA.
17. Ajouter un bouton manuel « Vérifier les mises à jour ».
18. Entourer les cases Divers d’un liseré noir.
19. Ajouter un résumé avant validation et des tests de parcours réels.
20. Remplacer le menu « Action » d’un congé par deux boutons directs et retirer
    « Repasser en souhaité ».
21. Placer le mode d’emploi neutre juste sous les PDF.
22. Aérer et élargir l’en-tête, moderniser Mois/Année et placer la mise à jour
    sous ses commandes.
23. Renforcer les liserés, améliorer Maladie et étendre les années jusqu’en 2050.
24. Intégrer l’œuvre colorée dans l’en-tête sous un voile clair adaptatif pour
    préserver la lisibilité sur ordinateur et mobile.
25. Ajouter des fonds illustrés distincts au menu, à l’accueil, aux congés,
    à la paie et aux téléchargements PDF, avec des voiles de lisibilité.
26. Uniformiser la hauteur de l’en-tête entre toutes les rubriques du menu.

## Points de vigilance pour une revue

- `src/App.tsx` et `src/styles.css` restent volumineux. Un découpage progressif a commencé par les soldes, le nettoyage et le détail mensuel de paie ; continuer fonctionnalité par fonctionnalité, sans refonte générale.
- Lire `CARTE_DU_PROJET.md` puis `AGENTS.md` avant d'ouvrir les gros fichiers afin de limiter le contexte nécessaire.
- Pour une demande limitée à une rubrique, générer un contexte court avec `npm run context:ai -- planning|leave|pay|pwa|form`.
- Les nombreuses règles CSS tardives servent de priorité finale à des demandes successives. Vérifier la cascade avant de déplacer ou fusionner des styles.
- Ne jamais modifier les règles de calcul du cycle, de paie, de récupérations ou de PDF sur une intuition : les tests existants doivent être complétés avant tout changement.
- Le mode `?demo=1` n’est activé publiquement que si la compilation l’autorise ; en développement il sert aux contrôles visuels.
- Les données réelles ne sont pas présentes dans cet export.
- Les fichiers `.env`, `.git`, `.netlify`, `node_modules` et les builds générés sont volontairement exclus.
- La publication de production ne doit être faite qu’après accord explicite de l’utilisatrice.

## État Git au moment de l’export

Le répertoire de travail contient des modifications non validées par un commit dans :

- `public/formulaire/index.html`
- `public/sw.js`
- `src/App.tsx`
- `src/main.tsx`
- `src/planningPdf.ts`
- `src/styles.css`
- `uiRefinement.test.mjs`

Ces fichiers correspondent aux évolutions récentes déjà testées et publiées. L’archive contient directement leur version actuelle complète.

## Installation locale

Pré-requis : Node.js récent et npm.

```bash
npm install
npm run dev
```

Puis ouvrir l’adresse indiquée par Vite. Le mode de démonstration local s’ouvre avec `?demo=1`.

## Vérification avant toute proposition de modification

```bash
npm test
npm run test:e2e
npm run build
```

La référence actuelle est de 222 tests unitaires et 16 parcours Chromium
réussis. Toute baisse du nombre de tests ou tout échec doit être expliqué.

## Déploiement

- Site Netlify lié : `planning-solo`.
- URL stable : https://planning-solo.netlify.app
- Configuration : `netlify.toml`.
- Build Netlify : `npm run build`.
- Répertoire publié : `dist`.
- Fonction : `netlify/functions/calendar.mts`.

Une autre IA peut analyser ou suggérer des changements, mais ne doit pas recevoir de jeton Netlify, de fichier `.env`, de données utilisateur ou de sauvegarde personnelle.
