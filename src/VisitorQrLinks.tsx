import { useState } from "react";

/** Un formulaire en ligne à faire flasher par un visiteur : le QR code
 *  d'origine et l'adresse qu'il ouvre, pour l'ouvrir aussi sans scanner. */
export type VisitorQrLink = {
  title: string;
  detail: string;
  url: string;
  qr: string;
};

export const VISITOR_QR_LINKS: VisitorQrLink[] = [
  {
    title: "Réclamation service client",
    detail: "Formulaire en ligne du Grand Palais Rmn",
    url: "https://l.ead.me/bg72nl",
    qr: "/useful-forms/reclamation-service-client-qr.png",
  },
  {
    title: "Objet perdu",
    detail: "Déclaration en ligne sur Troov",
    url: "https://l.ead.me/bg72lH",
    qr: "/useful-forms/objet-perdu-qr.png",
  },
];

/** Les QR codes pour les visiteurs, dans le format des fiches d'audioguide :
 *  ouvrir le formulaire, ou montrer le QR code à flasher. */
export function VisitorQrLinks({ links = VISITOR_QR_LINKS }: { links?: VisitorQrLink[] }) {
  const [shownQr, setShownQr] = useState("");
  return (
    <div className="useful-form-download-list visitor-qr-list">
      {links.map((link, index) => (
        <article key={link.title} className="useful-form-download-card useful-audioguide-card useful-qr-link-card">
          <span className="useful-form-file-icon useful-audioguide-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" /></svg>
          </span>
          <span className="useful-form-file-copy">
            <small>{index + 1}. QR CODE</small>
            <strong>{link.title}</strong>
            <small className="useful-audioguide-code">{link.detail}</small>
          </span>
          <span className="useful-audioguide-actions">
            <a href={link.url} target="_blank" rel="noopener noreferrer">Ouvrir le formulaire</a>
            <button type="button" aria-expanded={shownQr === link.title} onClick={() => setShownQr((current) => (current === link.title ? "" : link.title))}>
              {shownQr === link.title ? "Masquer le QR code" : "Afficher le QR code"}
            </button>
          </span>
          {shownQr === link.title ? (
            <figure className="useful-audioguide-qr">
              <img src={link.qr} alt={`QR code : ${link.title}`} width="240" height="240" />
              <figcaption>À flasher par le visiteur</figcaption>
            </figure>
          ) : null}
        </article>
      ))}
    </div>
  );
}
