type UserGuideDialogsProps = {
  guidePromptOpen: boolean;
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
  skipGuidePrompt: () => void;
  openGuideFromPrompt: () => void;
};

const GUIDE_LINKS = [
  ["guide-home", "1. Accueil"],
  ["guide-planning", "2. Planning et absences"],
  ["guide-leave", "3. Congés, heures et CET"],
  ["guide-pay", "4. Ma paie"],
  ["guide-tools", "5. PDF et programmation GP"],
  ["guide-resources", "6. Contacts et formulaires"],
  ["guide-colleagues", "7. Planning des collègues"],
  ["guide-account", "8. Messages, compte et mises à jour"],
] as const;

export function UserGuideDialogs({
  guidePromptOpen,
  guideOpen,
  setGuideOpen,
  skipGuidePrompt,
  openGuideFromPrompt,
}: UserGuideDialogsProps) {
  function scrollGuideTo(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {guidePromptOpen ? (
        <div className="modal-backdrop guide-prompt-backdrop" role="presentation">
          <section className="modal-card guide-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="guide-prompt-title">
            <span className="guide-prompt-icon" aria-hidden="true">?</span>
            <span className="step-label">Bienvenue dans Planning Solo</span>
            <h2 id="guide-prompt-title">Besoin d’un mode d’emploi rapide ?</h2>
            <p>Les fonctions importantes sont expliquées en huit étapes courtes.</p>
            <div className="guide-prompt-actions">
              <button className="secondary-button" type="button" onClick={skipGuidePrompt}>Plus tard</button>
              <button className="primary-action" type="button" onClick={openGuideFromPrompt}>Voir le guide</button>
            </div>
            <small>Vous pourrez le retrouver à tout moment en bas du menu ☰.</small>
          </section>
        </div>
      ) : null}

      {guideOpen ? (
        <div className="modal-backdrop guide-backdrop" role="presentation">
          <section className="modal-card guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
            <button className="modal-close" type="button" onClick={() => setGuideOpen(false)} aria-label="Fermer le mode d’emploi">×</button>
            <header className="guide-heading">
              <span className="step-label">Mode d’emploi</span>
              <h2 id="guide-title">Planning Solo, simplement</h2>
              <p>Choisissez une rubrique. L’essentiel tient en quelques lignes.</p>
            </header>

            <nav className="guide-toc" aria-label="Table des matières du mode d’emploi">
              <strong>Aller directement à…</strong>
              {GUIDE_LINKS.map(([id, label]) => (
                <button type="button" key={id} onClick={() => scrollGuideTo(id)}>{label}</button>
              ))}
            </nav>

            <div className="guide-content">
              <section id="guide-home" className="guide-section important">
                <span className="guide-number">1</span>
                <div><h3>Accueil</h3><ul>
                  <li>Choisissez votre groupe une seule fois.</li>
                  <li>« Aujourd’hui » indique votre situation et le groupe présent avec vous.</li>
                  <li>Le bloc suivant affiche votre prochain jour travaillé.</li>
                </ul></div>
              </section>

              <section id="guide-planning" className="guide-section">
                <span className="guide-number">2</span>
                <div><h3>Planning et absences</h3><ul>
                  <li>Touchez une date pour voir son détail ou ajouter une note.</li>
                  <li>Utilisez <strong>Poser un congé</strong> pour enregistrer une absence.</li>
                  <li>Sur téléphone, balayez le planning pour changer de mois.</li>
                </ul></div>
              </section>

              <section id="guide-leave" className="guide-section">
                <span className="guide-number">3</span>
                <div><h3>Congés, heures et CET</h3><ul>
                  <li>Ouvrez une carte pour consulter vos soldes ou votre historique.</li>
                  <li>Vous pouvez saisir les récupérations, heures supplémentaires et mécénats.</li>
                  <li><strong>Mon CET</strong> permet de suivre le solde et de préparer les formulaires officiels.</li>
                </ul></div>
              </section>

              <section id="guide-pay" className="guide-section important">
                <span className="guide-number">4</span>
                <div><h3>Ma paie</h3><ul>
                  <li>Vérifiez d’abord votre profil de paie.</li>
                  <li>Consultez l’estimation, les primes et les jours fériés du mois.</li>
                  <li>Ajoutez un bulletin PDF pour comparer l’estimation au montant réel. Le fichier n’est pas conservé.</li>
                </ul></div>
              </section>

              <section id="guide-tools" className="guide-section">
                <span className="guide-number">5</span>
                <div><h3>PDF et programmation GP</h3><ul>
                  <li><strong>Plannings PDF</strong> crée un document pour le groupe et l’année choisis.</li>
                  <li><strong>Programmation GP</strong> présente les expositions par galerie et par date.</li>
                </ul></div>
              </section>

              <section id="guide-resources" className="guide-section important">
                <span className="guide-number">6</span>
                <div><h3>Contacts et formulaires</h3><ul>
                  <li>Choisissez <strong>Formulaires</strong> pour ouvrir ou télécharger un document.</li>
                  <li>Choisissez <strong>Contacts</strong> pour appeler, envoyer un SMS ou un e-mail.</li>
                  <li>La déclaration d’accident réunit les documents, contacts et dates à enregistrer.</li>
                </ul></div>
              </section>

              <section id="guide-colleagues" className="guide-section">
                <span className="guide-number">7</span>
                <div><h3>Planning des collègues</h3><ul>
                  <li>Choisissez le nom visible dans l’annuaire.</li>
                  <li>Partagez votre planning uniquement avec les collègues choisis.</li>
                  <li>Vous pouvez arrêter un partage ou supprimer un accès à tout moment.</li>
                </ul></div>
              </section>

              <section id="guide-account" className="guide-section">
                <span className="guide-number">8</span>
                <div><h3>Messages, compte et mises à jour</h3><ul>
                  <li><strong>Écrire à l’administratrice</strong> permet de signaler une suggestion ou un problème, avec une photo si besoin.</li>
                  <li>Votre initiale ouvre votre compte et la gestion des données.</li>
                  <li>Les rappels sont activés automatiquement si votre téléphone les autorise.</li>
                  <li>Le bouton <strong>Mise à jour</strong> installe la dernière version quand elle est disponible.</li>
                </ul></div>
              </section>
            </div>

            <footer className="guide-footer">
              <button className="primary-action" type="button" onClick={() => setGuideOpen(false)}>J’ai compris</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
