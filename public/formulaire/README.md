# Architecture du formulaire autonome

Le formulaire reste une page autonome, servie directement depuis `public/formulaire/`.
Son point d’entrée `app.js` orchestre le DOM, la signature, les pièces jointes,
la génération PDF et le retour vers Planning Solo.

Les fonctions sans état sont isolées dans des modules ES testables :

- `form-value-utils.js` : masques, dates et heures saisies ;
- `form-calendar.js` : jours fériés et cycle de travail ;
- `form-file-utils.js` : lecture et validation locale des pièces jointes.
- `form-signature-controller.js` : persistance mobile, synchronisation du
  profil, canevas compact et fenêtre de saisie de la signature. Le contrôleur
  reçoit explicitement ses éléments DOM, ses accès d’état et ses callbacks ;
  il ne dépend pas des variables internes d’`app.js`.

`sheets.js` reste un fichier de données classique chargé avant `app.js`. Les
modules du formulaire figurent tous dans le shell de `sw.js` afin que la saisie
reste utilisable hors connexion. Toute nouvelle dépendance statique de `app.js`
doit également être ajoutée à cette liste.

La logique DOM encore présente dans `app.js` est volontairement extraite par
blocs progressifs. Le calendrier interactif et le PDF partagent encore beaucoup
d’état de page et ne doivent pas être réécrits en une seule opération.
