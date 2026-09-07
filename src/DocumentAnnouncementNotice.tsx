import { useCallback, useEffect, useState } from "react";
import {
  dismissUsefulDocumentAnnouncement,
  getUsefulDocumentAnnouncements,
  type UsefulDocumentAnnouncement,
} from "./usefulDocumentsApi";
import "./feedbackMessenger.css";

export function DocumentAnnouncementAlert({ notice, onOpen }: {
  notice: UsefulDocumentAnnouncement;
  onOpen: () => void;
}) {
  return (
    <div className="feedback-resolution-backdrop" role="presentation">
      <aside className="feedback-resolution-alert document" role="alertdialog" aria-modal="true" aria-labelledby="document-notice-title">
        <span className="feedback-resolution-check" aria-hidden="true">↓</span>
        <div>
          <small className="step-label">Nouveau document</small>
          <strong id="document-notice-title">{notice.title}</strong>
          <small>Disponible dans la rubrique « {notice.folderTitle} ».</small>
        </div>
        <button type="button" onClick={onOpen}>Voir le document</button>
      </aside>
    </div>
  );
}

export function DocumentAnnouncementNotice({ enabled, demoMode, isAdmin, onOpen }: {
  enabled: boolean;
  demoMode: boolean;
  isAdmin: boolean;
  onOpen: () => void;
}) {
  const [notices, setNotices] = useState<UsefulDocumentAnnouncement[]>([]);
  const refresh = useCallback(async () => {
    if (!enabled || isAdmin) return;
    if (demoMode) {
      setNotices(new URLSearchParams(location.search).get("demo-document-alert") === "1"
        ? [{ id: "33333333-3333-3333-3333-333333333333", documentId: "demo-document", title: "Consignes de la nouvelle exposition", folderTitle: "Formulaire Expo", createdAt: new Date().toISOString() }]
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

  if (!enabled || isAdmin) return null;
  const notice = notices[0];
  if (!notice) return null;
  const openDocument = () => {
    setNotices((current) => current.filter((item) => item.id !== notice.id));
    onOpen();
    if (!demoMode) void dismissUsefulDocumentAnnouncement(notice.id).catch(() => void refresh());
  };
  return <DocumentAnnouncementAlert notice={notice} onOpen={openDocument} />;
}
