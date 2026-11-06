# Mise à jour de la programmation GP

Le contrôle se lance à la main, avec « Contrôler maintenant » dans la veille
du site (Programme GP, compte administrateur). Il n’y a plus de passage
automatique. La fonction d’arrière-plan `gp-program-check-background` lit les
métadonnées publiques du site officiel du Grand Palais, puis compare le relevé
avec celui du contrôle précédent.

- Le premier passage crée seulement la référence initiale.
- Une nouveauté ou une modification crée une proposition.
- Un retrait du site doit être constaté à deux contrôles consécutifs avant
  d’être proposé, afin d’éviter les faux retraits temporaires.
- Seul le compte dont l’adresse correspond à `PROGRAM_ADMIN_EMAIL` reçoit et
  voit les propositions.
- Une proposition acceptée est enregistrée dans Netlify Blobs et devient
  immédiatement visible pour tous les comptes, sans nouveau déploiement.
- Les périodes d’inter expos des galeries 3–4, 8 et 7 sont recalculées à
  partir de la programmation acceptée, sans seconde mise à jour manuelle.

## Variables Netlify nécessaires

- `PROGRAM_ADMIN_EMAIL` : adresse du seul compte autorisé à valider.
- `GMAIL_APP_PASSWORD` : mot de passe d’application du compte Gmail qui envoie
  les alertes par e-mail, avec son adresse dans `GMAIL_SMTP_USER` ou, à défaut,
  `SENDGRID_FROM_EMAIL`.

Sans Gmail, les alertes passent par SendGrid (`SENDGRID_API_KEY`,
`SENDGRID_FROM_EMAIL`), puis par Resend (`RESEND_API_KEY`, `PROGRAM_ALERT_FROM`).

Ces variables restent côté serveur et ne sont jamais envoyées au navigateur.
Si l’envoi est momentanément indisponible, les propositions détectées restent
enregistrées pour ne perdre aucune mise à jour ; l’exécution signale simplement
que l’alerte n’a pas pu être envoyée. Il faut donc configurer et surveiller les
variables d’e-mail en production.
