import { useCallback, useEffect, useState } from "react";
import {
  dismissUsefulDocumentAnnouncement,
  getUsefulDocumentAnnouncements,
  markDocumentAnnouncementSeen,
  type UsefulDocumentAnnouncement,
} from "./usefulDocumentsApi";
import "./feedbackMessenger.css";

export function DocumentAnnouncementAlert({ notice, downloading = false, error = "", onDownload, onLater }: {
  notice: UsefulDocumentAnnouncement;
  downloading?: boolean;
  error?: string;
  onDownload: () => void;
  onLater: () => void;
}) {
  return (
    <div className="feedback-resolution-backdrop" role="presentation">
      <aside className="feedback-resolution-alert document" role="alertdialog" aria-modal="true" aria-labelledby="document-notice-title">
        <span className="feedback-resolution-check" aria-hidden="true">↓</span>
        <div>
          <small className="step-label">Document partagé</small>
          <strong id="document-notice-title">{notice.title}</strong>
          {notice.message ? <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{notice.message}</p> : null}
          <small>Disponible dans la rubrique « {notice.folderTitle} ».</small>
        </div>
        {error ? <p className="document-notice-error" role="alert">{error}</p> : null}
        <div className="document-notice-actions">
          <button type="button" disabled={downloading} onClick={onDownload}>{downloading ? "Téléchargement…" : "Télécharger maintenant"}</button>
          <button type="button" className="secondary" disabled={downloading} onClick={onLater}>Voir plus tard</button>
        </div>
      </aside>
    </div>
  );
}

export function DocumentAnnouncementNotice({ enabled, demoMode, isAdmin }: {
  enabled: boolean;
  demoMode: boolean;
  isAdmin: boolean;
}) {
  const [notices, setNotices] = useState<UsefulDocumentAnnouncement[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const refresh = useCallback(async () => {
    if (!enabled || isAdmin) return;
    if (demoMode) {
      setNotices(new URLSearchParams(location.search).get("demo-document-alert") === "1"
        ? [{ id: "33333333-3333-3333-3333-333333333333", documentId: "demo-document.pdf", title: "Consignes de la nouvelle exposition", folderTitle: "Formulaire Expo", createdAt: new Date().toISOString(), format: "PDF" }]
        : []);
      return;
    }
    try {
      setNotices((await getUsefulDocumentAnnouncements()).notifications);
    } catch {
      // Une indisponibilité réseau ne bloque jamais l’utilisation de l’application.
    }
  }, [demoMode, enabled, isAdmin]);

  useEffect(() => {
    if (!enabled || isAdmin) return;
    const check = () => document.visibilityState === "visible" && void refresh();
    void refresh();
    const timer = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, isAdmin, refresh]);

  const visibleId = enabled && !isAdmin ? notices[0]?.id : undefined;
  useEffect(() => {
    if (!visibleId || demoMode) return;
    const mark = () => { if (document.visibilityState === 'visible') void markDocumentAnnouncementSeen(visibleId).catch(() => {}); };
    mark(); document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [visibleId, demoMode]);

  if (!enabled || isAdmin) return null;
  const notice = notices[0];
  if (!notice) return null;
  const dismissNotice = () => {
    setNotices((current) => current.filter((item) => item.id !== notice.id));
    if (!demoMode) void dismissUsefulDocumentAnnouncement(notice.id).catch(() => void refresh());
  };
  const downloadDocument = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      const isStoredDocument = /^[a-f0-9-]{36}$/.test(notice.documentId);
      const format = notice.format || (notice.documentId.toLocaleLowerCase("fr").endsWith(".docx") ? "DOCX" : "PDF");
      const blob = demoMode
        ? new Blob([format === "PDF" ? "%PDF-1.7\nDocument de démonstration" : "Document de démonstration"], { type: format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
        : await fetch(isStoredDocument ? `/api/useful-documents?file=${encodeURIComponent(notice.documentId)}` : `/useful-forms/${encodeURIComponent(notice.documentId)}`, { credentials: "same-origin" }).then(response => {
            if (!response.ok) throw new Error("Téléchargement indisponible.");
            return response.blob();
          });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${notice.title.replace(/[^\p{L}\p{N} ._-]/gu, "").trim() || "document"}.${format.toLocaleLowerCase("fr")}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      dismissNotice();
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Le téléchargement n’a pas pu démarrer.");
    } finally {
      setDownloading(false);
    }
  };
  return <DocumentAnnouncementAlert notice={notice} downloading={downloading} error={downloadError} onDownload={() => void downloadDocument()} onLater={dismissNotice} />;
}
