export async function requestPasswordRecovery(email: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher("/api/password-recovery", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error("La demande de nouveau mot de passe a échoué");
}
