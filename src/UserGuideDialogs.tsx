type UserGuideDialogsProps = {
  guidePromptOpen: boolean;
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
  skipGuidePrompt: () => void;
  openGuideFromPrompt: () => void;
};

export function UserGuideDialogs({
  guidePromptOpen,
  guideOpen,
  setGuideOpen,
  skipGuidePrompt,
  openGuideFromPrompt,
}: UserGuideDialogsProps) {
  function scrollGuideTo(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <>
      {guidePromptOpen ? (
        <div className="modal-backdrop guide-prompt-backdrop" role="presentation">
          <section
            className="modal-card guide-prompt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-prompt-title"
          >
            <span className="guide-prompt-icon" aria-hidden="true">?</span>
            <span className="step-label">Bienvenue dans Planning Solo</span>
            <h2 id="guide-prompt-title">Souhaitez-vous consulter le mode d’emploi ?</h2>
            <p>
              Quelques minutes suffisent pour comprendre comment obtenir un
              planning et une estimation de paie fiables.
            </p>
            <div className="guide-prompt-actions">
              <button className="secondary-button" type="button" onClick={skipGuidePrompt}>
                Passer
              </button>
              <button className="primary-action" type="button" onClick={openGuideFromPrompt}>
                Consulter
              </button>
            </div>
            <small>Le mode d’emploi restera accessible dans le menu ☰, juste sous les plannings PDF.</small>
          </section>
        </div>
      ) : null}

      {guideOpen ? (
        <div className="modal-backdrop guide-backdrop" role="presentation">
          <section
            className="modal-card guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
          >
            <button className="modal-close" type="button" onClick={() => setGuideOpen(false)} aria-label="Fermer le mode d’emploi">×</button>
            <header className="guide-heading">
              <span className="step-label">Mode d’emploi</span>
              <h2 id="guide-title">Bien démarrer avec Planning Solo</h2>
              <p>Chaque rubrique de l’application est expliquée simplement.</p>
            </header>

            <nav className="guide-toc" aria-label="Table des matières du mode d’emploi">
              <strong>Accès rapide</strong>
              {([
                ["guide-navigation", "1. Accueil et planning"],
                ["guide-leave", "2. Poser une absence"],
                ["guide-recovery", "3. Congés et récupérations"],
                ["guide-cet", "4. Suivre et utiliser mon CET"],
                ["guide-pay", "5. Comprendre Ma paie"],
                ["guide-payslips", "6. Bulletins et estimations"],
                ["guide-pdf", "7. Plannings PDF"],
                ["guide-forms", "8. Formulaires utiles"],
                ["guide-program", "9. Programmation GP"],
                ["guide-contacts", "10. Contacts utiles"],
                ["guide-data", "11. Compte, données et mises à jour"],
              ] as const).map(([id, label]) => (
                <button type="button" key={id} onClick={() => scrollGuideTo(id)}>{label}</button>
              ))}
            </nav>

            <div className="guide-content">
              <section id="guide-navigation" className="guide-section important">
                <span className="guide-number">1</span>
                <div>
                  <h3>Accueil et planning</h3>
                  <p>
                    L’accueil rassemble les informations essentielles : votre situation aujourd’hui,
                    le prochain jour travaillé avec le groupe présent, les congés restants et le nombre
                    de jours qu’il reste à travailler jusqu’au 31 décembre. Utilisez <strong>Choisir mon groupe</strong>
                    une première fois ; le bouton affichera ensuite le groupe enregistré.
                  </p>
                  <ul>
                    <li>les boutons Mois, Année et Aujourd’hui permettent de changer rapidement de vue ;</li>
                    <li>sur téléphone, balayez le calendrier horizontalement pour passer au mois précédent ou suivant ;</li>
                    <li>touchez une date pour consulter son horaire, ajouter une note ou poser directement une absence ;</li>
                    <li>le compteur des jours travaillés exclut les congés, récupérations, maladies, grèves et jours Divers enregistrés.</li>
                  </ul>
                  <p>Le menu ☰ donne accès à toutes les autres rubriques. Le bouton de mise à jour reste dans l’en-tête.</p>
                </div>
              </section>

              <section id="guide-leave" className="guide-section">
                <span className="guide-number">2</span>
                <div>
                  <h3>Poser une absence</h3>
                  <p>
                    Le bouton <strong>Poser un congé</strong>, placé juste au-dessus du planning mensuel,
                    ouvre les choix Congé, Récupération, Arrêt maladie ou Divers, ainsi que Grève et CET.
                    Vous pouvez aussi toucher directement la case du jour concerné.
                  </p>
                  <ul>
                    <li>un congé validé diminue le solde correspondant et disparaît des prochains jours travaillés ;</li>
                    <li>un congé souhaité reste un repère modifiable et peut être retiré directement ;</li>
                    <li>un arrêt maladie est suivi séparément : il ne diminue pas vos droits à congés, mais peut modifier l’estimation de paie ;</li>
                    <li>Divers indique une journée non travaillée sans déduire de CA ou de RTT ;</li>
                    <li>Grève ne touche aucun solde et crée une retenue brute estimée au trentième.</li>
                  </ul>
                  <p>
                    Une date enregistrée peut être rouverte pour la modifier ou la supprimer.
                    Le planning, les compteurs, les soldes et la paie sont alors recalculés automatiquement.
                  </p>
                </div>
              </section>

              <section id="guide-recovery" className="guide-section">
                <span className="guide-number">3</span>
                <div>
                  <h3>Congés et récupérations</h3>
                  <p>
                    Cette rubrique réunit vos soldes de CA, RTT et fractionnement, ainsi que les suivis
                    Maladie, garde d’enfant, jours exceptionnels, Divers, congés CET et Grève.
                    <strong> Voir le détail</strong> affiche les dates enregistrées dans chaque catégorie.
                  </p>
                  <ul>
                    <li><strong>Reprendre mes absences précédentes</strong> ajoute les jours et dimanches déjà posés sans exiger leurs dates ;</li>
                    <li>les récupérations proposent journée, demi-journée, heures, jour férié ou formation : mettez en évidence les <strong>heures à poser</strong>, puis choisissez les dates ;</li>
                    <li>les heures supplémentaires sont saisies avec leurs horaires de début et de fin et restent consultables dans l’historique ;</li>
                    <li>les mécénats sont suivis séparément et rattachés à la paie concernée ;</li>
                    <li><strong>Autre → Mes demandes archivées</strong> conserve les demandes terminées sur l’appareil.</li>
                  </ul>
                  <p>
                    Pour la grève, deux journées encadrant des repos noirs du cycle peuvent étendre la retenue à toute la période.
                    Les CA enregistrés restent inchangés ; les autres jours intermédiaires incertains sont signalés « À vérifier ».
                  </p>
                </div>
              </section>

              <section id="guide-cet" className="guide-section important">
                <span className="guide-number">4</span>
                <div>
                  <h3>Suivre et utiliser mon CET</h3>
                  <p>
                    Dans <strong>Mon CET</strong>, indiquez si vos droits sont déjà ouverts. Sinon,
                    <strong> Faire une demande d’ouverture</strong> prépare le formulaire officiel.
                    Recopiez ensuite le solde actuel figurant sur votre relevé RH.
                  </p>
                  <ul>
                    <li><strong>Poser un congé CET</strong> ouvre le parcours habituel de demande de congé ;</li>
                    <li><strong>Ajouter une opération</strong> sert à corriger ou compléter le suivi du solde ;</li>
                    <li><strong>Remplir alimentation / indemnisation</strong> prépare le document annuel et son aide au remplissage.</li>
                  </ul>
                  <p>
                    Le formulaire d’alimentation ou d’indemnisation peut être préparé à tout moment,
                    mais il ne peut être envoyé qu’entre le <strong>15 novembre et le 31 décembre</strong>.
                    Les jours à conserver correspondent au nombre de jours qui resteront sur le CET après les choix saisis.
                    Si vous avez indiqué par erreur que le compte existe, utilisez <strong>Je n’ai pas de CET</strong> pour revenir en arrière.
                  </p>
                </div>
              </section>

              <section id="guide-pay" className="guide-section important">
                <span className="guide-number">5</span>
                <div>
                  <h3>Ma paie</h3>
                  <p>
                    Commencez par vérifier votre statut, votre quotité, votre traitement indiciaire,
                    l’indemnité de résidence et les autres valeurs connues dans le profil paie.
                    <strong> Primes et jours fériés</strong> détaille mois par mois les dimanches,
                    jours fériés, heures supplémentaires et mécénats.
                  </p>
                  <p>
                    Les dimanches avant la clôture sont estimés sur la paie annoncée ; ceux placés après
                    la clôture apparaissent comme reportés. Un jour férié finalement non travaillé est annulé.
                    La grève applique le trentième indivisible avec les valeurs du mois de la grève,
                    ou les dernières valeurs antérieures connues si le bulletin exact manque.
                  </p>
                </div>
              </section>

              <section id="guide-payslips" className="guide-section important">
                <span className="guide-number">6</span>
                <div>
                  <h3>Bulletins et estimations</h3>
                  <p>
                    Dans <strong>Ma paie → Bulletins et estimations → Affiner mes estimations</strong>,
                    déposez un bulletin récent pour reconnaître les éléments fixes et variables.
                    Plusieurs bulletins de mois différents améliorent le calcul des primes et permettent
                    d’utiliser les valeurs exactes du mois concerné.
                  </p>
                  <p>
                    Le détail mensuel rassemble le brut estimé, les primes, les absences et les retenues.
                    Les PDF analysés servent uniquement au calcul et ne sont pas conservés par Planning Solo.
                    Une estimation reste indicative jusqu’à réception du bulletin réel.
                  </p>
                </div>
              </section>

              <section id="guide-pdf" className="guide-section">
                <span className="guide-number">7</span>
                <div>
                  <h3>Plannings PDF</h3>
                  <p>
                    Choisissez l’année et le groupe, puis téléchargez le planning d’un groupe,
                    les trois groupes ou votre planning personnel avec toutes les absences enregistrées :
                    congés, récupérations, maladie, grève, CET, Divers et autres catégories suivies.
                    Le document <strong>Fériés travaillés 2026–2031</strong> présente uniquement les groupes
                    réellement présents chaque jour férié, sans les fériés compensés, afin de préparer plus facilement les échanges.
                    L’option vacances scolaires ajoute le tableau annuel des zones A, B et C.
                    Sur téléphone, le PDF s’ouvre ou se télécharge selon le navigateur utilisé.
                  </p>
                </div>
              </section>

              <section id="guide-forms" className="guide-section important">
                <span className="guide-number">8</span>
                <div>
                  <h3>Formulaires utiles</h3>
                  <p>
                    Les dossiers <strong>Formulaire Expo</strong>, <strong>Formulaire SAP</strong> et
                    <strong> Formulaire Brantôme</strong> regroupent les documents dans l’ordre prévu.
                    Touchez l’icône de téléchargement à droite d’un fichier pour l’enregistrer.
                    <strong> Horaires tickets resto</strong> affiche directement l’adresse et les horaires de retrait.
                  </p>
                </div>
              </section>

              <section id="guide-program" className="guide-section important">
                <span className="guide-number">9</span>
                <div>
                  <h3>Programmation GP</h3>
                  <p>
                    Consultez d’abord les <strong>galeries 3 et 4</strong>, la <strong>galerie 8</strong>
                    la <strong>galerie 7</strong> et le <strong>Palais des enfants</strong>. Le bouton
                    <strong> Autres</strong> donne accès à la <strong>Nef</strong> et aux
                    <strong> galeries 9 et 10</strong>. Choisissez ensuite
                    l’année ; les informations prévisionnelles sont signalées « À confirmer ».
                    Une fois la surveillance Netlify activée, le site officiel est vérifié une fois par jour.
                    Les changements sont proposés uniquement au compte administrateur, qui peut les accepter
                    pour tous les utilisateurs ou les ignorer. Une validation recalcule aussi les
                    <strong> périodes d’inter expos</strong>. Le badge <strong>Fermé</strong> signale une fermeture
                    exceptionnelle de journée complète sans modifier la paie ni les congés.
                  </p>
                </div>
              </section>

              <section id="guide-contacts" className="guide-section important">
                <span className="guide-number">10</span>
                <div>
                  <h3>Contacts utiles</h3>
                  <p>
                    <strong>Contacts Pompidou</strong> classe l’annuaire par RAS, Bureau administratif,
                    Ressources humaines, Service médical, Service informatique et Tickets restaurants.
                    Un numéro fixe lance directement l’appel ; un portable propose l’appel et le SMS,
                    sauf lorsqu’un contact est volontairement limité au SMS.
                  </p>
                  <p>
                    Touchez une adresse pour ouvrir Outlook ou l’application de messagerie avec le destinataire déjà renseigné.
                    Dans RAS, <strong>Envoyer un e-mail à toute l’équipe des RAS</strong> prépare un message collectif.
                    <strong> Contact GP‑RMN</strong> réunit les numéros d’accident, de secourisme et de supervision Expo.
                  </p>
                </div>
              </section>

              <section id="guide-data" className="guide-section">
                <span className="guide-number">11</span>
                <div>
                  <h3>Compte, données et mises à jour</h3>
                  <p>
                    Le bouton rond portant votre initiale ouvre le compte. <strong>Gérer mes données</strong>
                    permet d’exporter une sauvegarde JSON, de la restaurer ou de contrôler les données synchronisées.
                    Attendez toujours le message de confirmation avant de fermer l’application.
                  </p>
                  <p>
                    Lorsqu’une version est publiée, une fenêtre vous prévient sans rafraîchir automatiquement la page.
                    Le bouton <strong>Vérifier les mises à jour</strong> devient rouge et indique qu’une mise à jour est disponible :
                    vous choisissez quand l’installer. Le mode d’emploi reste accessible tout en bas du menu ☰.
                  </p>
                </div>
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
