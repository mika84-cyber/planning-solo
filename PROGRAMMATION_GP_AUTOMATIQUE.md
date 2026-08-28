# Mise à jour automatique de la programmation GP

La fonction Netlify `gp-program-monitor` s’exécute une fois par jour. Elle lit
les métadonnées publiques du site officiel du Grand Palais, puis compare le
relevé avec celui de la veille.

- Le premier passage crée seulement la référence initiale.
- Une nouveauté ou une modification crée une proposition.
- Un retrait du site doit être constaté deux jours consécutifs avant d’être
  proposé, afin d’éviter les faux retraits temporaires.
- Seul le compte dont l’adresse correspond à `PROGRAM_ADMIN_EMAIL` reçoit et
  voit les propositions.
- Une proposition acceptée est enregistrée dans Netlify Blobs et devient
  immédiatement visible pour tous les comptes, sans nouveau déploiement.
- Les périodes d’inter expos des galeries 3–4, 8 et 7 sont recalculées à
  partir de la programmation acceptée, sans seconde mise à jour manuelle.

## Variables Netlify nécessaires

- `PROGRAM_ADMIN_EMAIL` : adresse du seul compte autorisé à valider.
- `RESEND_API_KEY` : clé d’envoi des alertes par e-mail.
- `PROGRAM_ALERT_FROM` : expéditeur validé chez Resend, par exemple
  `Planning Solo <alertes@votre-domaine.fr>`.

Ces variables restent côté serveur et ne sont jamais envoyées au navigateur.
Sans configuration Resend, la vérification ne doit pas être activée en
production : la fonction refusera de finaliser un changement qu’elle ne peut
pas notifier.
