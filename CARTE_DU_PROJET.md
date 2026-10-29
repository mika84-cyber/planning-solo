# Carte rapide du projet

Cette carte sert à trouver le bon fichier sans relire toute l'application.

## Point d'entrée

- `src/main.tsx` : montage React, import des styles, enregistrement et mise à
  jour du service worker.
- `src/App.tsx` : orchestration générale (environ 1 180 lignes) : les états
  partagés, les hooks d'actions et de calculs, puis les messages et alertes
  et l'appel des composants de rubrique listés plus bas (`AppShellChrome`,
  `*SectionScreen`, `PlanningWorkspace`, `PlanningDialogLayer`,
  `AppDialogLayer`). Les calculs et les effets vivent dans les hooks
  `src/use*.ts` ; rechercher la fonctionnalité avant d'ouvrir une plage.
- `src/styles.css` : point d’entrée de la cascade CSS. Ses imports numérotés
  dans `src/styles/` conservent l’ordre historique ; rechercher la classe dans
  ces fichiers sans réordonner les passes. `src/styles/README.md` documente le
  découpage et les rares priorités `!important` encore nécessaires.
- `src/styles/06-planning-calendar.css` : tout le calendrier du planning (mois,
  grille, case du jour et ses repères), un bloc par composant ; ses retouches
  sombres restent dans `src/darkTheme.css`.
- `src/styles/14-planning-commands.css` : commandes du planning (cadre de la
  rubrique, barre du mois, Aujourd’hui, jours travaillés, effacement, choix
  d’un planning PDF), un bloc par composant, importé après la feuille 14.
- `src/styles/19-leave-page.css` : page Congés (soldes, règles des congés,
  absence longue, volets heures, mécénats et CET), importée par `main.tsx`
  après `dataManagement.css`.
- `src/styles/14-pay-page.css` et `src/styles/14-documents-contacts.css` :
  Ma paie, puis Documents et contacts et les plannings PDF, un bloc par
  composant, importées après `14-planning-commands.css`.

## Composants d'interface autonomes

- `src/CalendarCleanup.tsx` : panneau et boutons « Effacer plusieurs dates ou
  notes ».
- `src/LeaveBalancesSection.tsx` : cartes des soldes, choix de l'année et accès
  aux reprises manuelles ; les dix briques se suivent dans une seule grille,
  sans volet « Autres congés ».
- `src/CetSection.tsx` : configuration, simulation, opérations et historique du
  compte épargne-temps.
- `src/CetFormDialog.tsx` : saisie guidée des formulaires officiels d’ouverture,
  d’alimentation et d’indemnisation du CET.
- `src/grandPalaisProposalChanges.ts` : ce qui a changé entre la version
  gardée d'une exposition et celle lue par la veille (titre, précision,
  dates, espace, chaque tarif ajouté, retiré ou modifié) ; une proposition
  « Informations modifiées » l'affiche ancien → nouveau.
- `src/PayYearOverview.tsx` : « L'année en un coup d'œil » (dans l’en-tête,
  « coup d’œil » reste sur la seconde ligne : espace insécable dans
  `AppNavigation`), quatrième carte de Ma paie — les totaux de l'année (brut, primes, mécénats, impôt, net perçu,
  dans la langue des lignes de la paie), le net mois par mois en barres, les
  douze mois en tableau, chacun ouvrant son détail du calcul. Les chiffres
  viennent de `src/yearPayOverview.ts` (calcul pur, mêmes formules que la
  paie du mois) alimenté par `src/useYearPayOverview.ts` (profil de paie
  effectif de chaque mois, primes de l'année, maladie, grève, heures sup,
  mécénats) ; un mois dont le bulletin a été vérifié prend le brut et le net
  avant impôt réels gardés dans le compte. Écran `year` de `PayPage`.
- `src/PayEstimateDetails.tsx` : détail de la paie du mois — la cascade « Du
  brut au net », dont chaque étape s'ouvre sur son calcul (composition du
  brut, cotisations, passage au net), sans tableau qui la répète dessous —,
  navigation, heures supplémentaires et mécénats.
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
- `src/fractionRules.ts` : jours de fractionnement des agents d'accueil dès
  2027 (CA posés hors mai–octobre : 4 j → 1, 7 j → 2) ; partagé avec
  `netlify/lib/calendar-actions/save-request.mts`.
- `src/annualCarryOver.ts` : report des CA jusqu'au 30 avril suivant, partagé
  avec la validation serveur des demandes.
- `src/LeaveInfoCard.tsx` : ligne « Infos congés » au-dessus des soldes
  (report, fractionnement, congés exceptionnels ; les congés reportables au
  30 avril l'un sous l'autre) ; `src/longAbsence.ts` et `src/LongAbsenceNotice.tsx` :
  absences de 31 jours et plus et courrier de dérogation.
- `src/rememberedSession.ts` : « Rester connecté » ; copie de secours de la
  session, renouvellement du jeton au retour et nouvelle tentative des appels
  `/api/` refusés pour « connexion requise ». Garde aussi le dernier
  planning du compte pour l'ouverture immédiate (`e2e/instant-open.spec.ts`).
- `netlify/lib/identityUser.mts` : utilisateur connecté côté serveur, lu dans
  le jeton vérifié par Netlify.
- `src/DataManagementDialog.tsx` et `src/dataManagement.css` : sauvegarde,
  import et suppression des données.
- `src/ConnectionStatus.tsx` : état de la synchronisation.
- `src/AppNavigation.tsx` : en-tête et dock communs à tous les écrans. Plus
  de menu ☰ (retiré en octobre 2026, il répétait le dock) : l’en-tête garde
  deux boutons ronds, la mise à jour et le compte. Le menu du compte réunit
  l’identité, le mode sombre, Mes données, Installer l’application (démo ou
  navigateur qui sait installer), la messagerie interne et les outils de
  l’administrateur, puis la déconnexion ; les messages non lus de
  l’administrateur se lisent en pastille sur le bouton du compte
  (`account-feedback-badge`). Styles du menu du compte et de la mise à jour :
  `src/styles/18-account-and-update.css`.
- `src/AdminToolsPanel.tsx`, `src/adminTools.css`, `netlify/functions/admin-tools.mts`
  et `netlify/lib/adminTools.mts` : aperçu invité, message temporaire, rappel
  des jours fériés (`HomeAdminMessage.tsx`, raccourci vers les choix), groupes,
  corbeille de 30 jours et suivi des alertes. `admin-publications.mts` exécute
  les publications programmées chaque minute ; tests dans `admin-tools.function.test.ts`.
- `src/FeedbackMessenger.tsx`, `src/feedbackMessenger.css` et
  `src/useFeedbackMessaging.ts` : formulaire de retour privé, boîte de réception
  administrateur, réponses personnalisées, suppression, pastille de messages
  non lus et alertes privées centrées. Historique des messages collectifs
  (`feedback/broadcasts/`, repères `feedback/broadcast-seen/`) : qui les a vus
  et quand, anciens envois reconstitués (seuls les destinataires connus) ;
  texte relu en entier et corrigé (`edit-broadcast`, réaffichage possible) ;
  invités nommés, jamais par adresse.
- `src/AppDialogLayer.tsx` : assemblage des dialogues, messages, confirmations
  et panneaux de gestion qui restent pilotés par l’orchestrateur.
- Composants de rubrique sortis du JSX d’`App.tsx` en octobre 2026, même
  code, même rendu. Chacun reçoit des objets de props regroupés — les états
  d’un hook (`appShellUi`, `planningUi`, `workTimeUi`, `payUi`,
  `calendarData`…) ou un objet `actions` — qu’il destructure sous les noms
  d’origine ; les états et les mutations restent dans `App.tsx`.
  `src/AppShellChrome.tsx` : la coque (en-tête et menu du compte, navigation,
  propositions d’installation, aperçu invité et outils de
  l’administrateur, rappel des jours fériés).
  `src/HomeSectionScreen.tsx` : l’accueil (tableau de bord, premières étapes,
  notes à venir ; charge `HomeDashboard` dès le module).
  `src/LeaveSectionScreen.tsx` : la page Congés (soldes, CET, heures,
  absence longue, archive des demandes).
  `src/PaySectionScreen.tsx` : Ma paie, livré avec les écrans différés ;
  construit le contenu et la page pour `src/PayScreen.tsx`.
  `src/DocumentsSectionScreen.tsx` : Documents et contacts, programmation GP
  et plannings des collègues.
  `src/PlanningWorkspace.tsx` : l’espace du planning (barre de commandes,
  plannings PDF, panneaux d’une demande ou d’une sélection, calendrier du
  mois, échanges, effacement groupé ; `renderDay` reste dans `App.tsx`).
  Pendant une demande, un souhait ou une récupération (`datePicking`), le
  panneau sépare la barre du mois de la grille : `MonthNavigation`
  (`PlanningView.tsx`, `month-card-nav`) répète le mois et ses flèches juste
  au-dessus des jours ; un scénario e2e cible donc `.month-card-nav` ou
  `.calendar-toolbar` plutôt que « Mois suivant » seul.
  `src/PlanningDialogLayer.tsx` : les fenêtres du planning (échange, choix
  d’une demande, souhaits, groupe, fiche du jour, détail d’un solde), rendues
  avant `AppDialogLayer`. `src/scrollWhenReady.ts` amène à une ancre d’un
  écran chargé à la demande. Les contrôles textuels d’`uiRefinement.test.mjs`
  et `formSecurity.test.mjs` lisent ces fichiers avec `App.tsx` ;
  `AppShellChrome`, `HomeSectionScreen` et `DocumentsSectionScreen` ont un
  test de rendu (`renderToStaticMarkup`, rubriques différées remplacées par
  des témoins ou rendues après leur chargement).
- `src/HomeDashboard.tsx` : tableau d’accueil « en un coup d’œil ».
- « Que cherchez-vous ? » : une petite pastille crème au même endroit de
  chaque en-tête, en bas à gauche, le titre centré au-dessus — loupe dans un
  rond, flèche au bout, entière dans la partie foncée avant la diagonale (`AppHeader`, style dans
  `src/pageHeaders.css`), même surface que les trois commandes du haut, le
  texte à la couleur foncée de l’en-tête. Sur téléphone, la zone des
  commandes de l’en-tête est en `display: contents` : chaque commande (mise à
  jour, compte, menu) passe elle-même devant le titre, qui s’étend sur toute
  la largeur (`pageHeaders.css`), sinon le titre intercepte le toucher ; le
  menu du compte, qui fait contexte d’empilement, reste au-dessus de la
  pastille (z-index 4 contre 3), sinon son menu déroulant passe dessous. Elle ouvre `src/HelpSheet.tsx` (`helpSheet.css`, chargée à la
  demande) : « Que cherchez-vous ? », une fine bande aux couleurs de l’en-tête
  en haut, puis un champ « Un mot : congé, bulletin, radio… » qui filtre les
  questions à la frappe (`matchesHelpQuery` : chaque mot tapé, sans accent ni
  majuscule, dans la question, son chemin, ses mots-clés ou son thème ; « Rien
  pour … » sinon). Les questions sont rangées en cinq thèmes courts
  (`THEME_COLUMNS`), sur deux colonnes à l’ordinateur : Documents (téléphone,
  formulaire administratif, formulaire de congé, les 3 groupes de collègues, code radio) et Expositions (fiche d’expo,
  dates d’une exposition, audioguide, inter-expos) ; Mon planning (planning en
  PDF, partager mon planning), Ma paie et Déclarer. Fond pâle, filets fins,
  liseré, titre et icônes à la couleur du thème (`group-${key}` : Documents
  en bleu, Expositions en ocre, Mon planning en prune, Ma paie en vert,
  Déclarer en terracotta ; teintes éclaircies dans `darkTheme.css`). Le
  panneau garde sa hauteur pendant la recherche (téléphone) ou reste accroché
  en haut (ordinateur) : le champ ne bouge pas. L’exposition des Galeries 3 et
  4 (`galleryExpoFor`) y a deux lignes à son nom, séparées : sa fiche d’expo,
  le PDF du dossier Expo téléchargé d’un toucher (`useGalleryExpo` lit le
  dossier une fois à l’ouverture, `expoSheetFor`, sinon le dossier s’ouvre ;
  `GalleryExpoRow`), et son audioguide (`AudioguideRow`), qui déplie sur place
  le QR code à scanner et le code d’accès. `AppShellChrome` (`chooseHelp`) change de page,
  et refuse de compiler si une question n’y a pas de chemin (`never`) ;
  l’onglet ou la sous-page s’ouvre par `src/helpTargets.ts`
  (`requestHelpTarget` / `useHelpTarget`), lu par `UsefulResourcesHub`,
  `UsefulContactsSection` (codes radio), `UsefulFormsSection` (accident,
  dossier Expo),
  `ColleaguePlanningPage` (« Partager mon planning » ouvre la liste des
  collègues, « Les 3 groupes de collègues » la fenêtre `ColleagueGroupsDialog`,
  rendue hors du tableau pour s’ouvrir même quand il est absent ; hors d’aujourd’hui ou de la semaine en cours, une pastille
  « Aujourd’hui » / « Cette semaine » sous le titre du tableau y ramène,
  `colleague-today-step`), `GrandPalaisProgramSection` (onglets ; les dates d’une exposition ouvrent
  « Par espace » et descendent au choix des espaces, les inter-expos au
  détail des périodes) et `LeaveManagementPage` (heures et
  mécénats, CET). Une demande non servie s’oublie après 8 s. « Un
  formulaire de congé » (le formulaire de demande, vierge, `openBlankForm`,
  comme « Formulaire vierge » de Congés) est dans Documents, après « Un
  formulaire administratif » : il s’ouvre sur « Demande de congés » (`?feuille=conges`)
  plutôt que sur la dernière feuille utilisée. « Poser un
  congé » ouvre le choix du congé ; le congé choisi, on arrive directement
  sur les jours du planning (`requestFromHelp` dans `App`, `beginRequest`
  avec `landing` « calendar »).
- `src/PlanningCommandCenter.tsx` et `src/PlanningDayCell.tsx` : commandes du
  calendrier et rendu interactif d’une journée.
- `src/WorkExchangeDialog.tsx`, `src/WorkExchangePanel.tsx`,
  `src/workExchange.ts` et `src/useWorkExchangeActions.ts` : échanges complets
  entre collègues, toujours constitués d’une date cédée et d’une date rendue,
  sans ordre chronologique imposé et sans effet sur la paie ni les congés.
  Un échange proposé par un collègue (`netlify/functions/colleagues.mts`,
  `src/ColleagueRequestNotice.tsx`) est contrôlé à l’acceptation avec les mêmes
  règles (`validateWorkExchange`, groupe du profil du destinataire).
- `src/LeaveManagementPage.tsx` : composition de la page congés et
  récupérations.
- `src/PayPage.tsx`, `src/PayDashboard.tsx` (Ma paie : le mois et le net,
  les lignes de la paie, le bouton « Vérifier le bulletin », puis trois
  entrées de même facture — primes et jours fériés, détail du calcul, profil
  et réglages, ce dernier déplié sur place avec ses éléments de paie, sans
  volet intermédiaire), `src/PayMonthNav.tsx` (le navigateur de mois commun
  aux trois écrans), `src/PayAllowancesSection.tsx` et
  `src/PayslipCheckSection.tsx` : navigation paie, primes et composition du
  contrôle du bulletin ; `src/SundayDetailsList.tsx`, chargé à l’ouverture,
  détaille les dimanches par paie, reports compris (une demi-journée se lit
  dans la pastille du jour, « 25½ », `.sunday-day.half`). Le contrôle délègue les blocs autonomes à
  `src/PayslipVerificationCard.tsx`, `src/PayslipCalibrationCard.tsx` et
  `src/PayslipSettingsSections.tsx` (résultat, calibration, arrêts et
  paramètres), sans changer la structure DOM attendue par les styles. Le
  résultat d'un bulletin (`src/PayslipGapResult.tsx`) se lit dans l'ordre :
  ce qui manque (ou est en plus) sur le net, le trio Prévu / Payé / Écart,
  « D'où vient l'écart » ligne à ligne jusqu'au net (chaque cause avec son
  geste en lien, ou « ✓ enregistré dans votre profil / reporté sur … »
  quand la lecture l'a déjà pris en compte). Seul ce qui diffère se dit :
  ni lignes identiques, ni tableau, ni liste des champs repris, ni lignes
  d'heures sup ou de mécénats « prises en compte ». Puis
  « Que voulez-vous faire ? » : « C'est normal : corriger ma paie » (le mois
  prend les montants du bulletin) ou « C'est une erreur : proposition de
  courrier à envoyer aux RH » (le courrier passe devant quand une partie de
  l'écart reste inexpliquée). Viennent ensuite « Ajouter une page » et « Vérifier un autre
  bulletin ». Ce qui a été
  lu (champs remplis, lignes absentes) est dit sans alarme : le rouge est
  réservé aux écarts. Le brut et le net lus tiennent en une ligne sous la
  période reconnue (`.payslip-read-values`), sans tuiles.
- `src/confirmDialog.tsx` : la question posée dans l'application à la place
  de `window.confirm` — `useConfirmDialog` (état, dans App), `ConfirmDialog`
  (rendue par `AppDialogLayer` dans un `<dialog>` natif ouvert en modal : la
  couche supérieure du navigateur, au-dessus des outils administrateur et de
  la messagerie), `useConfirm` (contexte, pour tout composant)
  et `browserConfirm` (repli sans fenêtre montée). Les hooks d'actions la
  reçoivent en option `confirmAction` ; les boutons se nomment d'après le
  geste (« Supprimer », « Élément fixe », « Analyser quand même »). La fenêtre
  de message (« Impossible de continuer ») ne sert qu'aux refus ; une réussite
  passe par le toast (`showSuccess`).
- `src/useAdminUiState.ts` : états d'interface de l'administrateur (aperçu
  invité, panneau d'outils, relecture, statut connu), hors d'App.tsx.
- `src/PdfDownloadPage.tsx` : page de téléchargement des documents. L'année
  se choisit en pastilles (l'année en cours et les deux suivantes,
  `pdfYears`), « Plus » ouvre les années suivantes ; les vacances en
  pastilles Non / Oui, tuile rose.
- `src/UsefulFormsSection.tsx` : dossiers de formulaires et information tickets repas.
- `src/DocumentAnnouncementNotice.tsx` et `src/usefulDocumentsApi.ts` : alerte
  centrée des nouveaux documents, lecture et ajout administrateur.
- `src/DocumentEditDialog.tsx` et `netlify/lib/documentVersions.mts` : remplacement
  du fichier et restauration des versions précédentes. `useful-document-file.mts`
  conserve les liens des formulaires intégrés ; leur cache privilégie le réseau.
- `src/WorkAccidentSection.tsx` et `src/useWorkAccidentActions.ts` : procédure
  fonctionnaire/contractuel, contacts, documents et périodes d’accident de
  travail marquées dans le planning sans carence ; seuls les CA superposés sont
  retirés et recrédités automatiquement, les autres congés restant modifiables.
- `src/UsefulContactsSection.tsx` : annuaires Pompidou et GP-RMN, appels et e-mails directs.
  « Codes urgences radio » (FOX, TANGO…) : `netlify/lib/usefulRadioCodes.mts`,
  envoyés par `/api/contacts` aux seuls comptes connectés, jamais enregistrés.
- `src/GrandPalaisProgramSection.tsx` et `src/grandPalaisProgram.css` :
  programmation GP chargée à la demande (préparée au repos par
  `src/warmUpScreens.ts`), navigation par espace et périodes d’inter expos.
  Sous la recherche, les quatre vues (En ce moment, À venir, Par espace,
  Inter-expos) sont des intercalaires de classeur posés sur la carte qu’ils
  affichent : chacune a sa couleur (`data-view` : vert, bleu, ocre,
  terracotta) en liseré, dessin et teinte pâle ; la vue choisie, plus haute,
  prend la teinte de l’en-tête de la carte et s’y ouvre sans filet. Le bloc
  mord sur l’espacement de la page (même `clamp`, 12 px sur téléphone) :
  changer l’un oblige à changer l’autre.
  « Par espace » montre une exposition à cheval sur deux années une seule
  fois (`venueYearGroups`, même titre et mêmes dates) ; une exposition « À
  confirmer » mais datée donne déjà son délai (« Dans 4 mois… »).
  Les tarifs (`src/grandPalaisProgramData.ts`) sont ceux de la fiche
  officielle, par grille nommée quand elle en a plusieurs (`group` :
  session du matin, nocturne…) et ses horaires à côté de son nom
  (`priceGroupHours`, gardés quand une mise à jour remplace l’entrée),
  gratuité en montant nul — tue dans les
  galeries et au Palais des enfants (`PAID_ONLY_VENUES`), dite dans la Nef,
  ou dans une galerie quand la fiche le demande (`showFreePrices`, le Musée
  imaginaire d’Oli : la billetterie vend le billet des moins de 5 ans ; la
  fusion d’une mise à jour de la veille le garde, comme `priceNote`, et des
  tarifs relus — validés ou relevés sur le site — gardent à leur suite la
  ligne gratuite livrée qu’ils ne disent pas, `withKnownFreePrices`) —,
  condition en
  `priceNote` ; `ticketingUrl` est le site tiers qui porte la billetterie ou
  les tarifs quand le Grand Palais ne les publie pas. `grandPalaisTitleKey`
  reconnaît un même événement sous deux titres (« des Glaces » / « de
  Glace 2026 ») : une mise à jour acceptée remplace l’entrée livrée au lieu
  de la doubler.
- `src/GrandPalaisCheckPanel.tsx` : « Veille du site », réservée à
  l’administrateur — un petit radar crème et terracotta (faisceau qui tourne,
  point allumé quand le contrôle a trouvé du nouveau), date du dernier
  contrôle en grand, état, et « Contrôler maintenant ».
  Côté serveur : `netlify/lib/grandPalaisCheck.mts` (un passage de veille)
  et `netlify/functions/gp-program-check-background.mts` (à la demande,
  déposée par `/api/gp-program`). Il n’y a plus de passage automatique :
  l’administrateur lance chaque contrôle. Un contrôle manuel qui ne peut pas lire le site
  (maintenance, erreur 503…) est noté dans `last-check-failure` ; le panneau
  le lit (`checkProgress`) et dit la cause dès la relecture suivante.
- `src/VisitorQrLinks.tsx` : QR codes de réclamation et d’objet perdu, dans
  Contacts → « Pour les visiteurs ».
- `src/WorkTimeHistory.tsx` : historiques des heures sup et des mécénats.
- `src/appSections.ts` : point d’entrée des grandes pages ; les plus lourdes
  et les moins ouvertes (CET, programmation GP, paie, formulaires…) y sont
  différées. `src/deferredScreens.ts` réunit en un seul morceau livré la page
  Congés, les primes de la paie, les plannings PDF, les étapes d’une demande
  et les fenêtres des heures, des congés et des données ; `src/warmUpScreens.ts`
  prépare ces morceaux dès que l’application est au repos.
- `src/use*UiState.ts` et `src/useCalendarDataState.ts` : états spécialisés de
  l’authentification, du planning, de la paie, des heures, de la coque et des
  données synchronisées ; `App.tsx` conserve leur orchestration commune.
- Hooks sortis d’`App.tsx` en octobre 2026, même code, mêmes mémos :
  `src/useApplicationStartup.ts` (ouverture : démo sans compte, lien
  d’authentification, planning gardé sur l’appareil, session, relecture du
  planning et sa reprise au retour — rend `loadCalendar` et
  `clearCalendarData`), `src/useShellEffects.ts` (écrans préparés au repos,
  paramètres d’adresse, installation, largeur d’écran, mise à jour annoncée,
  fermeture des menus, vérification des mises à jour),
  `src/useSharedDataPrefetch.ts` (genres des collègues, programmation GP et
  rôle d’administrateur, contacts, groupes), `src/useSectionNavigation.ts`
  (menu, glissement, bouton Retour), `src/usePayProfileValues.ts` (valeurs du
  profil de paie du mois affiché), `src/useMonthPayEstimate.ts` (maladie,
  primes, crédits de récupération, heures sup, mécénats, grève, brut, net),
  `src/usePayMonthNavigation.ts` (mois affiché dans Ma paie, glissement de la
  carte des primes), `src/useWorkProfileActions.ts` (groupe, statut, quotité,
  horaires habituels), `src/useLeaveBalances.ts` (soldes de l’année, report
  au 30 avril, soldes par type et par année, CET, détail d’un solde),
  `src/useRequestTypeSelection.ts` (type choisi au départ d’une demande ;
  les congés annuels en journée entière, le matin ou l’après-midi, aux heures
  saisies sous la durée — `leaveMoment`, `leaveHours`, `selectLeaveMoment`,
  `selectLeaveHours`, `durationLeaveDay`, sélecteur « Durée du congé » de
  `RequestSelectionPanel` ; RTT et fractionnement ne se posent qu’en journée
  entière, et une demi-journée est toujours prise sur les congés annuels :
  plus de choix « Prise sur » dans les fenêtres). La durée se choisit aussi
  d’un toucher sous la ligne CA de « Que voulez-vous poser ? »
  (`AnnualDurationChoice` : `request-choice-moments`, puis, pour le matin ou
  l’après-midi, les heures à saisir avant les dates, `request-choice-hours`,
  proposées aux habituelles ; `onChoose(kind, type, moment, hours)` →
  `beginRequest(…, moment, hours)`, qui pose la date de départ). La durée
  vaut pour les dates touchées ensuite — une journée entière et une
  demi-journée se posent dans la même demande — et le même sélecteur
  (`LeaveDurationControl`) se retrouve au-dessus du planning pendant la
  demande (`planning-request-duration`), sous le congé des dates qu’on va
  toucher (`LeaveTypeTabs` : CA, RTT, fractionnement, et le type choisi s’il
  est autre, avec le nombre de dates de chacun ; le même composant sert aux
  « Choix courants » du panneau). Le type ne vaut que pour les dates touchées
  ensuite : la date de départ ne le suit que tant qu’elle est seule
  (`seedAlone`) ; matin et après-midi gardent chacun
  leurs heures (`LeaveHoursByMoment`, `leaveHoursFor`), et les heures
  saisies s’appliquent aux demi-journées déjà choisies de ce moment. Sur le
  formulaire, les journées vont dans « Congés annuels », les demi-journées
  dans « Congés en 1/2 journées » (`public/formulaire/app.js`, `buckets`).
  L’explication du panneau tient en une ligne,
  `src/useWorkedDaysOverview.ts` (jours travaillés, prochain extra, aperçu du
  jour), `src/useMecenatDraftCheck.ts` (mécénat en cours de saisie),
  `src/useDayDetailData.ts` (ce que la fiche du jour montre),
  `src/useNoteLists.ts` (notes à venir, recherche, congés d’Agnès ; une note
  posée sur plusieurs jours a chacun de ses jours dans la liste et dans la
  recherche, `upcomingNoteItems` et `noteSearchItems`, fonctions pures
  testées ; la croix d’une ligne n’efface que ce jour-là),
  `src/usePartnerNoteActions.ts` (suppression d’une note d’Agnès) ; une note
  du planning d’Agnès sans auteur enregistré (les plus anciennes) est la
  sienne (`partnerEntriesFromApi` dans `src/calendarPayload.ts`), seule une
  note signée Mika reste à lui. La
  rubrique Ma paie construit son contenu dans `src/PayScreen.tsx`, livré avec
  les écrans différés et appelé par `src/PaySectionScreen.tsx` ; `src/DemoExpiredScreen.tsx` est l’écran d’une démo
  expirée.
- `src/useWorkTimeActions.ts` : validations, écritures et suppressions des
  heures supplémentaires, récupérations et mécénats.
- `src/demoPayProfile.ts` : profil de paie fictif de la démo de
  prévisualisation (`VITE_DEMO_PAY_PROFILE=true`, posé par
  `.claude/dev-demo.cmd`) ; les tests gardent une démo sans profil.
- `src/useOvertimePay.ts` : paiement des heures supplémentaires — montant du
  bulletin, aperçu « À payer » pendant la saisie, heures payées en avance.
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
  sans rendu JSX dans l’orchestrateur. `beginRequest` fait défiler jusqu'au
  panneau de la demande, ou jusqu'aux jours du planning, une fois le panneau
  affiché (`scrollWhenShown` : il se charge à la demande et n'existe pas
  encore au premier usage).
- `src/usePlanningRequestActions.ts` : validation des demandes préparées,
  contrôle des soldes/capacités du formulaire, enregistrement direct des
  absences sans PDF et transfert typé vers le formulaire autonome.

## Logique métier

- `src/planningLogic.ts` : cycle des groupes, jours, dates, libellés, congés,
  dimanches et primes de jours fériés.
- Demi-dimanche : une seule demi-journée de congé posée un dimanche le
  laisse compter pour moitié (`share: 0.5` dans `collectWorkedDays` de
  `src/payAllowances.ts`), comme sur la paie ; la part payée un par un se
  calcule demis compris (`paidShares`), et `unpaidSundays` repère un demi
  dimanche manquant sur un bulletin. Les récupérations retirent toujours le
  dimanche entier.
- `src/appModel.ts` : types principaux et petits utilitaires partagés.
- Demi-journées d’ASA et de Divers : `leaveType: "half"` avec `halfBalance`
  `exceptional` ou `other` (`isStoredHalfBalance`, `isCountedOnlyHalfBalance`
  dans `src/planningLogic.ts`), comptées 0,5 dans leur suivi, hors quotas ;
  durée choisie au toucher de la date (`TimeSelectionDialog`), ligne « Jours
  exceptionnels » à 0,5 dans `public/formulaire/app.js`.
- `src/workPost.ts` : poste du jour (en salle par défaut, accueil ou
  billetterie), stocké en `work_post` sur la journée et partagé aux collègues
  par `personalPresenceForDate` (lettres E, C, B dans la semaine).
- `src/overtime.ts` : heures supplémentaires et récupérations.
- `src/mecenat.ts` / `src/mecenatRegulation.ts` : calcul des mécénats, au
  barème du jour de la vacation (décret n° 2010-147, arrêté du 18 mai 2010
  modifié ; depuis 2024, 22,90 € de 7 h à 22 h et 35 € de 22 h à 7 h).
- Dates d'inscription aux mécénats (`MecenatSignup`, `user/<id>/mecenat-signup/`,
  actions `save-mecenat-signup` / `delete-mecenat-signup`, lues dans
  `mecenat_signups`) : dans la carte Mécénats, « Mes dates d'inscription »
  (`src/MecenatSignupList.tsx`) ajoute une date et ses horaires s'ils sont
  connus, la retient (la déclaration s'ouvre, date et horaires remplis ; une fois le mécénat enregistré, la date s'efface —
  `retainedSignupRef`) ou l'efface. Hors sauvegarde exportée.
- `src/mecenatRules.ts` : amplitude de 12 h, repos de 11 h et lundis, signalés
  sans bloquer l’inscription d’un mécénat.
- `src/earlyPayment.ts` : mécénats et heures « à payer » qu’un bulletin vérifié
  a réglés dès le mois même.
- `src/payEstimate.ts` : disponibilité de l'estimation de paie.
- `src/payslip.ts` / `src/payslipReview.ts` : lecture et contrôle du bulletin.
  Les dimanches au-delà du 10e se lisent par moitié (357,05 € à 54,93 € =
  6,5, pas 7), sur PDF comme sur photo, et leur contrôle tolère moins d'un
  demi ; un report d'un demi-dimanche se garde tel quel côté serveur.
- `src/payslipRateSamples.ts` : montants d’un bulletin vérifié qui servent aux
  deux taux net avant impôt (brut, net, traitement, IFSE, éléments fixes,
  carence, Navigo, titres repas — jamais le fichier ni son texte), gardés
  dans le profil sous « AAAA-MM » (`payslip_rate_samples`, ajoutés mois par
  mois par `save-form-profile`, 24 au plus). `importPayslips` les réunit à
  ceux de la visite. `calculateNetRatios(readings, fallback)` cale les deux
  taux dès le premier bulletin : séparés par moindres carrés quand deux mois
  aux primes différentes le permettent, sinon ajustés ensemble, dans le
  rapport des taux de départ du statut, pour retrouver le net réel
  (`inspectNetRatioCalibration` dit « ready » ou « approximate »). Chaque
  bulletin vérifié ensuite affine. En démo, ils ne durent que la visite.
  `incoherentNetRatioReadings` écarte du calcul un bulletin mal lu (net à
  plus de 12 % des taux de départ, ou, dès trois bulletins, à plus de 6 % des
  autres). Le profil liste ces bulletins (`PayslipRateSampleList.tsx`, sous
  les éléments de paie, écartés signalés) ; « Retirer » envoie
  `removePayslipRateSamples` et recale les taux
  (`removePayslipRateSample` dans `usePayActions`). Un bulletin retiré, ou
  relu pour le même mois, emporte les montants que lui seul avait posés dans
  le profil (`amountsPosedOnlyBy` ; le serveur efface un montant reçu à
  `null`).
- `src/sundayReport.ts` : le report automatique de dimanches décidé à la
  lecture d'un bulletin ; relu, le même mois repart du compte entier, et la
  nouvelle lecture ajuste ou retire le report que la précédente avait
  provoqué (`importPayslips`, message « venu d'une lecture précédente »).
- `src/payslipGapChoices.ts` : devant un écart du bulletin, le geste qui
  l'explique sans doute (taux PAS ou montant du bulletin à enregistrer,
  mécénat attendu non payé à reporter sur la paie suivante, dimanches non
  payés à reporter, demi compris, statut à passer en fonctionnaire,
  compensation des fériés à revoir) ; `PayslipVerificationCard` l'affiche en
  lien sur la cause, d'après l'écart tel qu'il reste, et les actions de paie
  l'exécutent (`savePayAmount(field, value)`, `deferMecenats`,
  `changeStatus`, écran des primes).
- `src/payslipGapExplanation.ts` : `explainPayslipGapChain` remonte de
  chaque ligne qui diffère (chiffrée sur le brut ; dimanches par moitié)
  aux cotisations prélevées dessus (taux fixe ou variable de l'estimation),
  aux titres repas et Navigo, puis à l'impôt, jusqu'au net versé : la somme
  des lignes est l'écart au centime, un reste devient une ligne
  « inexpliquée », quelques centimes sans cause ne sont qu'un arrondi
  (`matches`). La lecture d'un bulletin met le profil à jour : l'écart
  s'explique donc contre l'estimation gardée juste avant
  (`PayEstimateSnapshot`, `payEstimateSnapshot` de `usePayUiState`, pris par
  `onImport` dans `payContent`). L'impôt prélevé se lit sur la ligne « PAS
  prélèvement à la source » (`incomeTax`). Les heures sup et les mécénats
  payés se lisent sur leurs lignes et se comparent comme les autres causes ;
  des mécénats payés au seul taux de jour disent la majoration de nuit qui
  manque, avec le texte qui la fixe (`references`, cité dans le courrier).
  Un rappel d'heures sup ou de mécénats n'est pas une ligne ponctuelle
  (`oneOffExtraLines`) : l'estimation le compte déjà. L'impôt exonère heures
  sup et mécénats (`estimatedIncomeTax` de `payEstimate.ts`, aussi pour
  l'estimation du mois et l'année), et des taux de cotisations recalés par
  la lecture se disent comme tels. Le courrier ne réclame ni le taux
  d'imposition ni des taux recalés.
- `src/payslipAcceptedGap.ts` : un écart accepté (décision « ok » gardée
  avec `gap` dans `payslip_verifications`) fait prendre au mois les
  montants du bulletin, en valeurs absolues (`correctedPayMonth`) ; Ma paie
  affiche alors « Net payé », « Bulletin vérifié · écart accepté » et ce qui
  était prévu (`acceptedGapSummary`).
- `src/payslipGapLetter.ts` / `src/PayslipLetterSheet.tsx` : le courrier à
  la hiérarchie (destinataire, mot facultatif, nom et signature du profil),
  avec l'écart, ses causes et la demande de régularisation, puis le détail
  attendu / bulletin sous la signature ; aperçu, PDF
  (`courrier-bulletin-AAAA-MM.pdf`) ou envoi par e-mail. « Modifier le
  texte » ouvre l'objet et le texte (`body`, paragraphes séparés par une
  ligne vide) à la réécriture ; gardés avec l'anomalie (`letterSubject`,
  `letterBody`), ils se rouvrent tels quels, et « Revenir au texte proposé »
  les rend. Il remplace l'ancien relevé d'anomalies. Le résultat de la
  vérification n'a plus de tableau ligne à ligne.
- `src/payslipOcr.ts` : reconnaissance locale des photos de bulletins avec le
  moteur et le modèle français auto-hébergés dans `public/ocr/`. Un bulletin
  fait deux pages : le bouton « Photographier » ouvre l'appareil
  (`capture="environment"`), une lecture incomplète
  (`isIncompletePayslipReading`) attend l'autre page sans rien demander ni
  enregistrer (`payslipPhotoPending`, « Il n'y a pas d'autre page » →
  `finishPayslipPhotos`), et le moteur reste prêt une minute pour la page
  suivante. La feuille
  est d'abord redressée (inclinaison mesurée par `payslipSkewDegrees` de
  `src/payslipImageQuality.ts`), et le code de rubrique (« 641.28 ») n'est
  jamais lu comme un montant.
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
  `work-exchange.mts` enregistre ou supprime atomiquement les deux cases d’un
  échange et restaure leur état précédent en cas d’échec.
- `netlify/lib/sharedCalendarBridge.mts` et `netlify/lib/sharedBridgeQueue.mts` :
  copies des congés et notes de Mika vers le planning d’Agnès, une seule fois
  par écriture (un lot annulé n’envoie rien) ; une copie qui n’aboutit pas
  attend dans l’espace de Mika et repart, dans l’ordre, à la prochaine
  écriture ou ouverture (pause de deux minutes après un échec).
- `netlify/lib/calendarShared.mts` : types, validations et utilitaires partagés
  par les gestionnaires du calendrier.
- `netlify/lib/recoveryBalance.mts` : solde d’heures de récupération côté
  serveur, majorations comprises (fériés selon le groupe du profil), commun à
  `save-request`, `save-recovery-use` et `delete-overtime`, qui le lisent sous
  le même verrou `lock/recovery-balance`.
- `e2e/app.spec.ts` : `isPlainWorkDay(date, group)` choisit un jour travaillé
  ordinaire (ni férié, ni fermeture) pour les scénarios qui partent
  d'aujourd'hui, afin qu'ils ne dépendent pas de la date où ils tournent.
- `netlify/tests/calendar.function.test.ts` : tests directs d’authentification,
  d’isolation et d’écriture de l’API calendrier.
- `netlify/functions/feedback.mts` : stockage privé des retours, photos,
  réponses et notifications de résolution ; l’accès à la boîte de réception et
  aux actions d’administration est réservé à `PROGRAM_ADMIN_EMAIL`.
- `netlify/functions/useful-documents.mts` : ajout sécurisé de PDF/DOCX par
  l’administrateur, stockage, alertes par compte invité et téléchargement.
- `netlify/lib/documentAnnouncementEmail.mts` : e-mail individuel annonçant un
  nouveau document aux comptes invités.
- `netlify/lib/` : validation, stockage par utilisatrice et sauvegardes.
- `public/formulaire/index.html`, `form.css`, `app.js`, `device.js` et
  `sheets.js` : structure, présentation, logique, adaptation mobile et modèles
  du formulaire autonome de demande.
  Sur le site autonome Congé CP seulement, le groupe de cycle se choisit dans
  le calendrier (`#calGroupChoice`, `chooseCycleGroup`) : il nourrit la case
  « Groupe » de la feuille quand elle en a une, sinon le profil, pour les
  feuilles d'échange et de remplacement de jour férié qui n'ont pas cette case.
  Sous `/formulaire/` de Planning Solo, `app.js` retire ce choix d'après la
  balise `planning-api` et le bandeau renvoie à la case « Groupe ».
  À l’ouverture, la feuille est celle d’un transfert (`?planning=1`,
  `?echange=1`), sinon celle que demande l’adresse (`?feuille=conges`, le
  formulaire vierge de l’application), sinon la dernière utilisée
  (`demandes:v4:last`).
  Feuilles : congés, récupérations, échange (`form-bg-4.png`, dates et
  horaires recopiés chez le collègue via `mirror`), remplacement de jour férié
  (`form-bg-5.png`, calendrier limité aux fériés travaillés via `cal: 'holiday'`,
  date et horaires recopiés chez le collègue) et annulation.
- `scripts/build-congecp.mjs` : site autonome « Congé CP » (congecp), déposé à
  la main sur Netlify Drop. `npm run build:congecp` recopie
  `public/formulaire/` dans `dist-congecp/`, retire les blocs
  `planning-solo-only` de la page (le retour vers l'application), passe la
  balise `planning-api` à « none » — la signature reste alors sur l'appareil,
  sans appel à `/api/calendar` —, écrit un `_headers` reprenant les protections
  de `netlify.toml` et date le cache du service worker. Tests dans
  `congecpBuild.test.mjs`.

## PDF et PWA

- `src/useAnnualPdfExport.ts` : chargement différé de l'export PDF.
- `src/planningPdf.ts` : génération des documents.
- `src/jspdfUnusedModule.ts` et l'alias de `vite.config.ts` : html2canvas,
  DOMPurify et canvg, optionnels dans jsPDF, ne sont pas livrés ; les méthodes
  `html()` et `addSvgAsImage()` de jsPDF sont donc indisponibles.
- `src/jspdfPngInflate.ts`, même alias : pako, que fast-png (décodeur PNG de
  jsPDF) n'utilise que pour décompresser, cède la place à fflate, déjà livré
  avec jsPDF (−43 Kio bruts) ; l'encodeur PNG de fast-png n'est pas livré.
- `public/formulaire/pdf-engine.js` : le moteur PDF du formulaire autonome,
  pdf-lib seul (UMD, `window.PDFLib`), chargé au premier PDF demandé
  (`loadPdfEngine`, `PDF_ENGINE_VERSION` pour le cache). Dans `app.js`,
  `drawPdfSheet` dessine chaque feuille avec lui — fond, tampons, aplats,
  champs, croix des cases, signatures — aux mêmes positions qu'avec jsPDF
  autrefois (repère converti, ligne de base « au milieu » = milieu + 0,35 ×
  corps) ; `buildPdfBytes` y ajoute l'observation et les justificatifs.
  jsPDF n'est plus embarqué dans le formulaire (moteur 855 → 502 Kio bruts,
  307 → 199 Kio compressés) ; seule l'application le charge encore, pour les
  plannings PDF.
- `scripts/minify-standalone.mjs` : compacte à la construction le formulaire
  autonome (`public/formulaire`), copié tel quel par Vite, moteur PDF compris.
  Le compactage lui-même vit dans `scripts/lib/compact-standalone.mjs`,
  partagé avec la construction du site Congé CP.
- `public/sw.js` : cache hors ligne et activation des mises à jour. À la
  construction, `scripts/stamp-sw.mjs` donne au cache l’empreinte de la
  version et remplit `PRECACHE` : code, styles, polices et images légères
  (≈ 3,7 Mo), téléchargés dès l’installation pour que l’application soit
  complète hors ligne dès la première visite.
- `e2e-pwa/pwa.spec.ts` (`npm run test:pwa`) : la version de production,
  construite dans `dist-pwa-e2e` et servie par `scripts/serve-dist.mjs`, avec
  le service worker actif — mise en cache, réouverture hors ligne, annonce et
  activation d’une nouvelle version. À lancer dès qu’on touche `public/sw.js`,
  `src/main.tsx` ou `scripts/stamp-sw.mjs`.
- `public/manifest.webmanifest` : installation de la PWA.
- `src/InstallAppNotice.tsx` : bandeau « Installer l’application sur votre
  téléphone ou ordinateur » proposé aux invités dont le navigateur sait
  installer l’application (Android, ordinateur) ; `src/AppleInstallNotice.tsx`
  explique la marche à suivre sur iPhone et iPad.
- `scripts/check-bundle-budget.mjs` : plafonds CI du JavaScript, du CSS et des
  deux animations de contrôle de paie afin d’éviter de réintroduire des médias
  trop lourds.

## Tests à choisir selon la demande

- Planning et groupes : `src/planningLogic.test.ts`.
- CET : `src/cet.test.ts` et `src/CetSection.test.tsx`.
- Formulaires CET : `src/cetFormsPdf.test.ts`.
- Paie : `src/payEstimate.test.ts`, `src/payslip.test.ts`,
  `src/payslipReview.test.ts`, `src/payslipGapExplanation.test.ts`,
  `src/payslipAcceptedGap.test.ts`, `src/payslipGapLetter.test.ts`,
  `src/PayslipLetterSheet.test.tsx`, `src/PayslipCheckSection.test.tsx`.
- Heures : `src/overtime.test.ts`, `src/useOvertimePay.test.tsx`.
- Mécénats : `src/mecenat.test.ts`, `src/mecenatRules.test.ts`,
  `src/earlyMecenatPayment.test.tsx`.
- API et stockage : `src/calendarApi.test.ts`, `netlify/lib/*.test.ts`.
- Semaine partagée des collègues, de l'enregistrement à la lecture (EX, AC,
  BI, F, A, 1/2) : `netlify/tests/colleagueSharedWeek.function.test.ts`.
- PDF : `src/pdfSmoke.test.ts`.
- Sécurité du formulaire : `formSecurity.test.mjs`.
- Finitions demandées : `uiRefinement.test.mjs`.
- Composants extraits : tests `*.test.tsx` portant le même nom.
- Parcours réels avec Playwright : `e2e/app.spec.ts`, exécuté sur ordinateur,
  mobile (Pixel 7) et Z Fold sous Chromium, et sur iPhone 14 sous WebKit
  (projet `iphone`, moteur installé par `npx playwright install webkit`).

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

Avant une publication : `npm test`, `npm run lint`, `npm run check`,
`npm run build`, puis `npm run test:e2e` (et `npm run test:pwa` si le service
worker ou son enregistrement change). Le contrôle des dépendances des
hooks est actif partout, `App.tsx` compris.

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
