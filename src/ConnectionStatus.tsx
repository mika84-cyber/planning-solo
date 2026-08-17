type Props = {
  online: boolean;
  syncStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt: string;
};

export function ConnectionStatus({ online, syncStatus, lastSavedAt }: Props) {
  if (!online)
    return (
      <div className="connection-status offline" role="status" aria-live="polite">
        Hors connexion — les modifications ne peuvent pas être enregistrées.
      </div>
    );
  if (syncStatus === "saving")
    return (
      <div className="connection-status saving" role="status" aria-live="polite">
        Enregistrement…
      </div>
    );
  if (syncStatus === "error")
    return (
      <div className="connection-status error" role="alert">
        Échec de synchronisation — vérifiez votre connexion.
      </div>
    );
  if (syncStatus === "saved")
    return (
      <div className="connection-status saved" role="status" aria-live="polite">
        Enregistré à {new Date(lastSavedAt).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    );
  return null;
}
