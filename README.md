# Planning solo

Planning de travail personnel : cycle de 21 jours à 3 groupes, congés et
récupérations, jours fériés travaillés, indemnités, export PDF annuel et
formulaire de demande. L’accès est privé et les données de planning sont
isolées par compte Netlify Identity.

Cette application est une reprise du planning partagé Mika/Agnès, ramenée à un
profil de planning par compte : ni second profil superposé, ni calque
« vacances scolaires ». Des comptes invités peuvent être autorisés ; leur
connexion peut déclencher une alerte privée vers le compte administrateur.

## Mettre en ligne

1. Créer un dépôt GitHub et y pousser ce dossier.
2. Sur Netlify, « Add new site » → « Import an existing project » → ce dépôt.
   Le fichier `netlify.toml` fournit déjà la commande de build (`npm run
   build`), le dossier publié (`dist`) et les fonctions (`netlify/functions`).
3. Activer **Netlify Identity** sur le site, puis, dans ses réglages :
   - « Registration » sur **Invite only** ;
   - inviter l’adresse e-mail de l’administratrice et, si nécessaire, celles
     des comptes invités autorisés.
4. Le stockage (Netlify Blobs, magasin `planning-solo`) se crée tout seul au
   premier enregistrement. Aucune variable d'environnement à renseigner.

Chaque site Netlify a sa propre instance Identity et son propre stockage :
ce planning n'a aucun point de contact avec le planning partagé d'origine.

## Développer en local

```bash
npm install
npm run dev
```

Le projet requiert Node.js 22.12 ou une version plus récente, comme les
versions actuelles des bibliothèques Netlify utilisées en production.

L'appli s'ouvre sur `http://localhost:5173`. L’accès à l’application nécessite
une authentification Netlify Identity ; aucun lien de démonstration public ne
permet d’entrer sans compte.

Autres commandes :

- `npm run check` — contrôle de types ;
- `npm run lint` — erreurs sémantiques, hooks React et accessibilité statique ;
- `npm test` — tests unitaires (cycle, congés, indemnités, PDF) ;
- `npm run test:coverage` — tests avec seuils minimaux de couverture ;
- `npm run test:e2e` — parcours Chromium sur ordinateur, mobile et Z Fold,
  avec un audit d’accessibilité ciblé ;
- `npm run build` — build de production, comme sur Netlify ;
- `npm run check:bundle` — contrôle des budgets JavaScript et CSS du build ;
- `npm run check:css` — empêche une hausse de la complexité de la cascade ;
- `npm run test:pdf:visual` — génère deux PDF de contrôle locaux, avec et sans
  vacances scolaires ;
- `npm run check:ci` — contrôle complet hors parcours navigateur.

Le workflow GitHub Actions `.github/workflows/quality.yml` exécute ces
vérifications à chaque demande de fusion et à chaque envoi sur la branche
principale. Dependabot propose chaque semaine les mises à jour npm et chaque
mois celles des actions GitHub. Une publication Netlify reste une action
séparée : la CI ne publie pas automatiquement l’application.

## Données, confidentialité et sauvegardes

Les entrées, périodes et réglages sont isolés par identifiant Netlify Identity.
Le menu du compte ouvre **Gérer mes données**, qui permet :

- d’exporter une sauvegarde JSON complète et réimportable ;
- de restaurer une sauvegarde après validation de son format (l’état remplacé
  est archivé côté serveur avant la restauration) ;
- d’archiver les anciennes clés globales dans l’espace privé du compte ;
- d’effacer les données du compte après confirmation explicite.

Le fichier exporté contient des informations personnelles et des paramètres de
paie : il doit être conservé dans un emplacement privé. Les écritures liées
(par exemple une période couvrant plusieurs jours) sont envoyées en lot et
restaurées automatiquement si une sous-opération échoue. Une modification
concurrente connue est refusée avec un conflit plutôt qu’écrasée.

## À personnaliser avant usage

- **Groupe du cycle** : se choisit dans l'appli (vue Année) et se retient dans
  le profil.
- **Nom et signature** : dans le formulaire de demande.
- **Traitement, IFSE, taux net/brut, PAS…** : écran « Vérifier mon bulletin ».
  Les barèmes livrés (indemnité dominicale, coefficients de jour férié)
  correspondent à l'employeur d'origine ; les montants propres à la personne
  se saisissent, ils ne sont pas pré-remplis.
- **Vacances scolaires** : le calque a été retiré. Le tableau des vacances
  existe toujours dans le moteur PDF (`src/planningPdf.ts`) si le besoin
  revient.
