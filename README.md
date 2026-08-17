# Planning solo

Planning de travail personnel : cycle de 21 jours à 3 groupes, congés et
récupérations, jours fériés travaillés, indemnités, export PDF annuel et
formulaire de demande. Un seul compte, aucune donnée partagée.

Cette application est une reprise du planning partagé Mika/Agnès, ramenée à un
seul utilisateur : ni second profil, ni calque « vacances scolaires », ni
notifications (elles n'existaient que pour prévenir l'autre personne).

## Mettre en ligne

1. Créer un dépôt GitHub et y pousser ce dossier.
2. Sur Netlify, « Add new site » → « Import an existing project » → ce dépôt.
   Le fichier `netlify.toml` fournit déjà la commande de build (`npm run
   build`), le dossier publié (`dist`) et les fonctions (`netlify/functions`).
3. Activer **Netlify Identity** sur le site, puis, dans ses réglages :
   - « Registration » sur **Invite only** ;
   - inviter l'adresse e-mail de l'utilisatrice.
4. Le stockage (Netlify Blobs, magasin `planning-solo`) se crée tout seul au
   premier enregistrement. Aucune variable d'environnement à renseigner.

Chaque site Netlify a sa propre instance Identity et son propre stockage :
ce planning n'a aucun point de contact avec le planning partagé d'origine.

## Développer en local

```bash
npm install
npm run dev
```

L'appli s'ouvre sur `http://localhost:5173`. Sans Netlify, la connexion ne
fonctionne pas : ajouter `?demo=1` à l'URL pour entrer sans compte, avec des
données en mémoire (mode disponible uniquement en développement).

Autres commandes :

- `npm run check` — contrôle de types ;
- `npm test` — tests unitaires (cycle, congés, indemnités, PDF) ;
- `npm run build` — build de production, comme sur Netlify.

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
