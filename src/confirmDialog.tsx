import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Une question posée dans l'application, à la place de la boîte du
 * navigateur : un titre, quelques lignes, deux boutons nommés d'après le
 * geste (« Supprimer », « Élément fixe »…). Une seule question à la fois.
 */
export type ConfirmOptions = {
  title: string;
  /** Lignes séparées par des sauts de ligne : un paragraphe chacune. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** « danger » pour une suppression : le bouton principal en rouge. */
  tone?: "default" | "danger";
};
export type ConfirmAction = (options: ConfirmOptions | string) => Promise<boolean>;
export type ConfirmRequest = { options: ConfirmOptions; resolve: (ok: boolean) => void };

const normalize = (options: ConfirmOptions | string): ConfirmOptions =>
  typeof options === "string" ? { title: options } : options;

/** Sans fenêtre montée (test de rendu, composant hors de l'application) :
 *  la boîte du navigateur, comme avant. */
export const browserConfirm: ConfirmAction = (options) => {
  const { title, message } = normalize(options);
  return Promise.resolve(window.confirm([title, message].filter(Boolean).join("\n\n")));
};

const ConfirmContext = createContext<ConfirmAction>(browserConfirm);
export const ConfirmProvider = ConfirmContext.Provider;
/** La question de l'application, depuis n'importe quel composant. */
export const useConfirm = () => useContext(ConfirmContext);

/** L'état de la question en cours, et la fonction qui la pose : une
 *  promesse, résolue par le bouton choisi (ou « non » si une autre question
 *  la remplace). */
export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const pending = useRef<ConfirmRequest | null>(null);
  const confirm = useCallback<ConfirmAction>(
    (options) =>
      new Promise<boolean>((resolve) => {
        pending.current?.resolve(false);
        const next = { options: normalize(options), resolve };
        pending.current = next;
        setRequest(next);
      }),
    [],
  );
  const answer = useCallback((ok: boolean) => {
    pending.current?.resolve(ok);
    pending.current = null;
    setRequest(null);
  }, []);
  return { confirm, request, answer };
}

/** La fenêtre de la question : un <dialog> natif ouvert en modal, donc dans
 *  la couche supérieure du navigateur — au-dessus de toute autre fenêtre,
 *  celle des outils administrateur ou de la messagerie comprises. */
export function ConfirmDialog({
  request,
  onAnswer,
}: {
  request: ConfirmRequest | null;
  onAnswer: (ok: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !request) return;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, [request]);
  if (!request) return null;
  const { title, message, confirmLabel = "Confirmer", cancelLabel = "Annuler", tone = "default" } = request.options;
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onAnswer(false);
      }}
      onMouseDown={(event) => event.target === event.currentTarget && onAnswer(false)}
    >
      <section className="modal-card warning-modal confirm-modal">
        <span className="warning-symbol" aria-hidden="true">{tone === "danger" ? "!" : "?"}</span>
        <h2 id="confirm-dialog-title">{title}</h2>
        {message
          ? message
              .split("\n")
              .filter(Boolean)
              .map((line) => <p key={line}>{line}</p>)
          : null}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={() => onAnswer(false)}>
            {cancelLabel}
          </button>
          <button
            className={tone === "danger" ? "delete-confirm-button" : "save-button"}
            type="button"
            onClick={() => onAnswer(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </dialog>
  );
}
