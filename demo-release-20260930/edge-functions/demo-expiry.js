const EXPIRES_AT = Date.parse("2026-09-30T22:00:00.000Z");

export default async function demoExpiry(_request, context) {
  if (Date.now() < EXPIRES_AT) {
    const response = await context.next();
    const headers = new Headers(response.headers);
    headers.set("x-planning-demo-expires", "2026-09-30T22:00:00.000Z");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return new Response(
    `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Démonstration expirée</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; background: #f5f7fb; color: #14233d; font: 16px/1.5 system-ui, sans-serif; }
      main { width: min(520px, 100%); padding: 32px; border: 1px solid #14233d; border-radius: 24px; background: white; text-align: center; box-shadow: 0 14px 40px rgba(20, 35, 61, .10); }
      h1 { margin: 0 0 12px; font-size: 1.6rem; }
      p { margin: 0; color: #526078; }
    </style>
  </head>
  <body>
    <main>
      <h1>Cette démonstration a expiré</h1>
      <p>La période d’essai de Planning Solo s’est terminée le 30 septembre 2026.</p>
    </main>
  </body>
</html>`,
    {
      status: 410,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    },
  );
}
