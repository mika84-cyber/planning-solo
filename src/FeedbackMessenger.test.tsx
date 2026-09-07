import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeedbackMessenger, FeedbackResolutionAlert } from "./FeedbackMessenger";
import { DocumentAnnouncementAlert } from "./DocumentAnnouncementNotice";

describe("messagerie interne", () => {
  const baseProps = {
    open: true,
    isAdmin: false,
    demoMode: true,
    onClose: () => undefined,
    onUnreadCountChange: () => undefined,
  };

  it("propose un message simple, l’anonymat et une photo sans exposer la boîte privée", () => {
    const html = renderToStaticMarkup(<FeedbackMessenger {...baseProps} />);
    expect(html).not.toContain("De quoi s’agit-il ?");
    expect(html).not.toContain("Une suggestion");
    expect(html).not.toContain("Un bug");
    expect(html).toContain("Votre message");
    expect(html).toContain("Rester anonyme");
    expect(html).toContain("Joindre une photo");
    expect(html).not.toContain("Nom affiché");
    expect(html).not.toContain("Messages reçus");
  });

  it("rend la boîte accessible au seul administrateur", () => {
    const html = renderToStaticMarkup(<FeedbackMessenger {...baseProps} isAdmin />);
    expect(html).toContain("Messages reçus");
    expect(html).toContain("Sélectionnez un message");
    expect(html).not.toContain("Envoyer un retour");
    expect(html).toContain("Écrire à tous les comptes invités");
    expect(html).toContain("aucun e-mail");
  });

  it("affiche l’alerte privée de résolution", () => {
    const html = renderToStaticMarkup(<FeedbackResolutionAlert notice={{ id: "1", kind: "bug", resolvedAt: "2026-09-05" }} onDismiss={() => undefined} />);
    expect(html).toContain("a été traité");
    expect(html).toContain("D’accord");
  });

  it("affiche une réponse personnalisée au centre de l’écran", () => {
    const html = renderToStaticMarkup(<FeedbackResolutionAlert notice={{ id: "2", kind: "idea", type: "reply", message: "Merci, votre proposition est retenue.", createdAt: "2026-09-05" }} onDismiss={() => undefined} />);
    expect(html).toContain("Vous avez reçu une réponse");
    expect(html).toContain("Merci, votre proposition est retenue.");
    expect(html).toContain("feedback-resolution-backdrop");
  });

  it("affiche un message collectif comme une annonce de l’administratrice", () => {
    const html = renderToStaticMarkup(<FeedbackResolutionAlert notice={{ id: "4", kind: "suggestion", type: "broadcast", message: "Information importante.", createdAt: "2026-09-07" }} onDismiss={() => undefined} />);
    expect(html).toContain("Message de l’administratrice");
    expect(html).toContain("Information importante.");
    expect(html).toContain("D’accord");
  });

  it("présente le nouveau document dans une alerte centrale", () => {
    const html = renderToStaticMarkup(<DocumentAnnouncementAlert notice={{ id: "3", documentId: "doc-1", title: "Consignes exposition", folderTitle: "Formulaire Expo", createdAt: "2026-09-07" }} onOpen={() => undefined} />);
    expect(html).toContain("Nouveau document");
    expect(html).toContain("Consignes exposition");
    expect(html).toContain("Formulaire Expo");
    expect(html).toContain("Voir le document");
    expect(html).toContain("role=\"alertdialog\"");
  });
});
