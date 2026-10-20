# Organisation de la cascade

`src/styles.css` est le point d’entrée unique. Ses imports numérotés reproduisent
strictement l’ordre historique de la cascade. Un nouveau fichier doit être ajouté
à la position où ses règles doivent réellement s’appliquer ; il ne faut pas
déplacer un bloc simplement pour regrouper des sélecteurs qui se ressemblent.

Les fichiers `03`, `04`, `05`, `06`, `08`, `12`, `13` et `14` isolent les
principaux domaines quand les blocs étaient suffisamment contigus. Les fichiers
de raffinements conservent les passes historiques inter-domaines dont le
déplacement modifierait la priorité CSS.

## Usage résiduel de `!important`

Les couleurs et ombres communes sont définies dans `01-foundation-auth.css`.
Les finitions de page de `productRefinements.css`, chargées après les styles
des menus par `main.tsx`, réutilisent ces variables pour les actions et cartes.
Elles ne recolorent pas les cases du calendrier ni les catégories de congés.
Les actions de danger et la proposition de mise à jour gardent leur priorité
visuelle propre. Éviter de créer une nouvelle couleur par bouton.

Les occurrences conservées ont été auditées. Elles correspondent principalement
à quatre situations où retirer la priorité modifierait le rendu :

- marqueurs de congé, récupération, grève ou fermeture qui doivent écraser le
  fond générique d’une case du calendrier ;
- variantes mobiles/Fold qui neutralisent une grille définie avec un sélecteur
  plus spécifique dans une passe antérieure ;
- neutralisation des animations avec `prefers-reduced-motion`, recommandée pour
  l’accessibilité même face à des transitions déclarées plus spécifiquement ;
- composants historiques partageant plusieurs classes génériques (`save-button`,
  `request-panel`, `choice-picker`) pour lesquels une suppression isolée change
  encore la cascade calculée.

Les règles finales de date de fermeture et les nouvelles cartes de paie ont été
renforcées par un sélecteur local explicite, ce qui a permis d’y supprimer les
priorités forcées sans changer leur rendu.

## Budget automatique

`npm run check:css` bloque désormais toute remontée au-dessus de la baseline
nettoyée : lignes totales, `!important`, media queries, taille d'une feuille et
nombre de références aux trois familles historiquement les plus redéclarées
(`top-header`, `pdf-download-screen` et `today-overview`). Les commentaires sont
ignorés par le comptage afin qu'une explication de cascade ne consomme pas le
budget. Une nouvelle variante doit donc remplacer ou consolider une ancienne
règle au lieu d'ajouter une passe finale.

La passe du 29 août a notamment :

- regroupé les calques communs des en-têtes Paie et Congés ;
- supprimé une largeur desktop d'en-tête entièrement annulée par la feuille
  finale ;
- fusionné les trois anciennes passes mobiles de l'atelier PDF ;
- retiré l'ancienne carte Groupe d'« Aujourd'hui », absente du DOM actuel ;
- supprimé une première couleur verte d'« Aujourd'hui » immédiatement écrasée
  par la finition bleue.

## Calendrier du planning

`06-planning-calendar.css` réunit le mois, sa grille et la case du jour
(`MonthCalendar`, `PlanningDayCell`) : un bloc par composant, les variantes
téléphone regroupées en fin de fichier. Dans un bloc, l'ordre historique est
gardé là où deux règles de même spécificité se disputent une propriété. Ne
restent ailleurs que les feuilles chargées après lui : retouches sombres
(`darkTheme.css`), vacances scolaires (`schoolVacations.css`) et notes
partagées (`sharedNotes.css`).

La conversion sombre (`src/darkStyles.ts`) recopie en fin de cascade les
couleurs des règles dont le sélecteur ne nomme pas la case. Une couleur
écrasée en clair peut donc encore servir en sombre : c'est le cas de
`.leave-calendar-marker-cet`, volontairement placé avant le repère commun.
Avant de retirer une couleur qui semble morte, vérifier aussi le rendu sombre.

La passe du 20 octobre 2026 a ramené les 213 règles du calendrier, réparties
dans douze feuilles, à 116 règles dans ce fichier, sans changement de rendu :
styles calculés identiques élément par élément sur 170 états (clair et
sombre, cinq largeurs, fiche du jour, menus, sélection, galerie de toutes les
variantes de case). Elle a notamment :

- retiré la vue compacte `.mini-day` et les repères `.compact`, que
  `MonthCalendar` ne rend plus, ainsi que le ruban `.leave-band` ;
- supprimé les bordures des demi-journées, annulées par `border: 0`, et les
  anciens fonds des récupérations, recouverts par leurs `!important` ;
- fusionné ou retiré les règles en double (grève posée et en sélection,
  contour et fond de chaque récupération, étiquettes REC, pastille du férié
  échangé).

## Commandes du planning

`14-planning-commands.css` réunit les commandes du planning
(`PlanningCommandCenter`, le bouton d'effacement de `CalendarCleanup`) : cadre
de la rubrique, choix d'un planning PDF, barre du mois (flèches, mois, année,
Aujourd'hui), jours travaillés et effacement multiple, un bloc par composant.
Il est importé juste après `14-planning-final.css` : à spécificité égale, ses
règles l'emportent donc sur celles des feuilles 02 à 14, et cèdent aux
feuilles chargées ensuite. Restent ailleurs, volontairement :

- les listes communes à plusieurs rubriques : `.app-shell > .planning-workspace-shell`
  (largeur et marges, feuille 14), la bordure des boutons terracotta
  (`:root :is(… .today-button …)`, feuille 14) et le fond blanc des rubriques
  (feuille 17) ;
- les finitions de `productRefinements.css` (bordure, marges intérieures et
  en-tête des rubriques, fond `#fbf6ef` d'Aujourd'hui, des jours travaillés et
  de l'effacement), plus spécifiques ou chargées après ;
- le bandeau « Poser un congé » (`.planning-leave-panel`, feuille 14 et
  `planningCalendarRefinement.css`).

Les règles sans `.planning-workspace-shell.framed` dessinent la vue hors
accueil (demande ouverte depuis une autre rubrique), où le planning n'est pas
cadré. Les flèches `.period-step` servent aussi à la page Collègues, retouchée
dans `colleaguePlanning.css`.

La passe du 20 octobre 2026 a ramené ces 220 règles, réparties dans 14
feuilles, à 93 règles dans ce fichier, sans changement de rendu : styles
calculés identiques élément par élément sur 462 états (clair et sombre, onze
largeurs de 360 à 1280 px, survol, appui et focus forcés, vues cadrée et non
cadrée). Elle a notamment :

- relevé, élément par élément, la déclaration gagnante de chaque propriété
  (y compris les copies de la conversion sombre), puis retiré les 269
  déclarations qui ne gagnaient jamais et une vingtaine d'autres qui
  redisaient une valeur déjà acquise ;
- retiré le choix du groupe (`.planning-group-*`), les libellés et `select`
  de `.controls`, les cases `article` du volet des jours travaillés et le
  bouton d'effacement de la barre du mois (`.calendar-bulk-delete-mobile`),
  qui ne sont plus rendus ;
- replié dans leurs blocs les bordures et ombres que les listes communes des
  feuilles 11 et 12 posaient sur le cadre, `.controls` et la barre du mois ;
- remplacé les six `!important` des jours travaillés par une seule règle :
  plus rien ne leur dispute la typographie.

## Page Congés

`19-leave-page.css` réunit la page Congés et récupérations
(`LeaveManagementPage`, `LeaveBalancesSection`, `LeaveInfoCard`,
`LongAbsenceNotice` et les volets de la zone d'outils) : barre d'actions,
avis d'absence longue, soldes, mémo « Règles des congés », volets des heures
supplémentaires, des mécénats et du CET, un bloc par composant, les variantes
selon la largeur regroupées en fin de fichier. Elle remplace
`leaveCollapsibles.css` et `leaveMenus.css` et se charge depuis `main.tsx`
au même endroit, juste après `dataManagement.css` : à spécificité égale, ses
règles l'emportent sur `styles.css`, `16-work-accident.css` et
`dataManagement.css`, et cèdent à `productRefinements.css` (cadres, en-têtes et
tailles de texte communs des rubriques) et à `darkTheme.css`. Restent
ailleurs, volontairement :

- le cœur du CET (`04-leave-cet.css`), dont les classes servent aussi à son
  formulaire et aux choix de demande ;
- les lignes d'historique des heures et des mécénats (`WorkTimeHistory`,
  `.overtime-history article`, feuille 09), que la démonstration n'affiche pas ;
- les demandes archivées et les listes communes à plusieurs rubriques
  (bordure de la feuille 09, `.app-shell > …` de la feuille 14).

Les sélecteurs `::-webkit-details-marker` des volets sont gardés même si
Chromium ne les relève pas : Safari s'en sert pour masquer le triangle.

La passe du 20 octobre 2026 a ramené ces 310 règles, réparties dans 15
feuilles, à 203 règles dans ce fichier, sans changement de rendu : styles
calculés identiques élément par élément sur 774 états (clair et sombre, treize
largeurs de 360 à 1280 px, volets ouverts et historiques dépliés, survol,
appui et focus forcés ; avis d'absence longue, son courrier, solde saisi sans
date et heures au-delà du plafond injectés avec le balisage des composants).
Elle a notamment :

- retiré 171 déclarations qui ne gagnaient jamais, d'après le relevé des
  déclarations gagnantes (copies sombres comprises), et une dizaine d'autres
  qui redisaient une valeur déjà acquise ;
- retiré les règles d'anciennes mises en page : cartes d'heures et de CET
  enfants directs de la grille ou de la zone d'outils, ordres forcés des
  tuiles, `em` des soldes, boutons `.planning-leave-mobile` et
  `.planning-leave-desktop`, libellés « Ouvrir » / « Fermer » des volets ;
- replié dans le bloc des heures la bordure et l'ombre que la liste commune
  de la feuille 12 posait sur leurs cases, et retiré nos sélecteurs des
  listes communes où ils ne gagnaient plus rien (feuilles 10, 11, 12, 17) ;
- retiré quatre `!important` devenus inutiles : le solde saisi sans date a
  désormais un sélecteur plus précis, et « Ajouter des heures manuellement »
  se charge après les boutons secondaires.
