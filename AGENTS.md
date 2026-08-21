# Consignes de travail ciblé

Ce projet est une PWA React personnelle. Pour préserver les crédits et éviter
les régressions, ne chargez jamais `src/App.tsx` ou `src/styles.css` en entier
par défaut.

1. Lisez d'abord `CARTE_DU_PROJET.md`.
2. Repérez la fonctionnalité avec `git grep -n` ou `Select-String`.
   Pour un transfert vers une autre IA, utilisez d'abord
   `npm run context:ai -- planning|leave|pay|pwa|form`.
3. N'ouvrez que les plages de lignes et les composants concernés.
4. Préservez les comportements métier existants ; préférez une extraction
   progressive à une réécriture générale.
5. Après une modification, lancez le test ciblé, puis `npm test`,
   `npm run check` et `npm run build` si le changement touche la production.
   Pour un parcours d’interface, ajoutez ou adaptez aussi un scénario dans
   `e2e/` puis lancez `npm run test:e2e` (ordinateur et mobile).
6. `uiRefinement.test.mjs` contient encore des contrôles textuels : lorsqu'un
   affichage est déplacé vers un composant, mettez le test à jour et ajoutez si
   possible un test de rendu du composant.
7. Les règles tardives de `src/styles.css` peuvent volontairement surcharger
   des règles plus anciennes. Ne déplacez un bloc CSS qu'après avoir vérifié
   tous les sélecteurs et media queries associés.

Ne modifiez pas les données métier, le stockage Netlify, le service worker ou
la publication lorsqu'une demande porte uniquement sur l'interface.
