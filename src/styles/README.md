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
