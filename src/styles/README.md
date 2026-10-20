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
