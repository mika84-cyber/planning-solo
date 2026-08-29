import { ChoicePicker } from "./ChoicePicker";
import { euros } from "./appModel";
import { MONTHS, periodLabel, s } from "./planningLogic";
import type { PayslipCheckSectionProps } from "./PayslipCheckSection";

type Props = Pick<
  PayslipCheckSectionProps,
  "allowances" | "isContractuel" | "sickLeaves" | "paySettingsOpen" |
  "setPaySettingsOpen" | "missing" | "missingFields" | "baseSalary" | "ifse" |
  "carenceDay" | "otherFixed" | "cia" | "netRatioFixed" | "netRatioVariable" |
  "navigo" | "mealVoucherDeduction" | "pasRate" | "payDrafts" |
  "setPayDrafts" | "savingPay" | "onSavePayAmount" | "ciaMonth" | "onSaveCiaMonth"
>;

export function PayslipSettingsSections({
  allowances,
  isContractuel,
  sickLeaves,
  paySettingsOpen,
  setPaySettingsOpen,
  missing,
  missingFields: netEstimateMissing,
  baseSalary,
  ifse,
  carenceDay,
  otherFixed,
  cia,
  netRatioFixed,
  netRatioVariable,
  navigo,
  mealVoucherDeduction,
  pasRate,
  payDrafts,
  setPayDrafts,
  savingPay,
  onSavePayAmount: savePayAmount,
  ciaMonth,
  onSaveCiaMonth: saveCiaMonth,
}: Props) {
  return (
    <>
        {/* La retenue (un jour de carence puis 10 %/jour) est une règle de
            fonctionnaire ; le régime d'une contractuelle (IJSS, subrogation)
            est différent et n'est pas vérifié ici. */}
        {!isContractuel && sickLeaves.arrets.length > 0 && (
          <section className="allowance-card">
            <header>
              <span>Arrêts maladie {allowances.year}</span>
              <strong className="negative">−{euros(sickLeaves.total)}</strong>
            </header>
            <table className="allowance-table">
              <tbody>
                {sickLeaves.arrets.map((arret) => (
                  <tr key={arret.id}>
                    <th scope="row">
                      {periodLabel(arret.from, arret.to)}
                      <small>
                        {arret.days} jour{s(arret.days)} · carence +{" "}
                        {arret.reducedDays} à 10 %
                      </small>
                    </th>
                    <td className="negative">−{euros(arret.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="allowance-card pay-function-card pay-elements-card">
          <header>
            <div>
              <span className="step-label">Références utilisées par les calculs</span>
              <h3>Éléments de paie</h3>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setPaySettingsOpen((current) => !current)}
              aria-expanded={paySettingsOpen}
            >
              {paySettingsOpen ? "Replier" : missing ? "À compléter" : "Voir"}
            </button>
          </header>
          {paySettingsOpen ? (
            <>
          {missing ? (
            <p className="allowance-note warn">
              Information{netEstimateMissing.length > 1 ? "s" : ""} encore
              manquante{netEstimateMissing.length > 1 ? "s" : ""} : {netEstimateMissing.join(", ")}.
              Un bulletin lisible peut les remplir automatiquement.
            </p>
          ) : null}
          <div className="pay-field-grid">
          {(
            [
              {
                field: "baseSalary" as const,
                label: "Traitement de base",
                value: baseSalary,
                hint: "Ex. 1855,88",
                use: "primes de férié et retenue maladie",
              },
              {
                field: "ifse" as const,
                label: "IFSE",
                value: ifse,
                hint: "Ex. 416,66",
                use: "retenue maladie",
              },
              {
                field: "carenceDay" as const,
                label: "Jour de carence",
                value: carenceDay,
                hint: "Ex. 78,17",
                use: "à recopier du bulletin",
              },
              {
                field: "otherFixed" as const,
                label: isContractuel
                  ? "Indemnité de résidence"
                  : "Autres éléments fixes",
                value: otherFixed,
                hint: isContractuel ? "3 % du traitement, déjà calculée" : "Ex. 75,84",
                use: isContractuel
                  ? "3 % du traitement de base ; ne modifiez que si votre bulletin montre un autre montant"
                  : "résidence + SMIC comp. + ICHCSG + MGEN − transfert",
              },
              {
                field: "cia" as const,
                label: "CIA",
                value: cia,
                hint: "Ex. 476,00",
                use: "complément indemnitaire annuel",
              },
              {
                field: "netRatioFixed" as const,
                label: "Taux net avant impôt — traitement",
                value: netRatioFixed,
                hint: "",
                use: "estimation automatique, affinée lorsque les bulletins permettent un calcul fiable",
                percent: true,
                automatic: true,
              },
              {
                field: "netRatioVariable" as const,
                label: "Taux net avant impôt — primes",
                value: netRatioVariable,
                hint: "",
                use: "estimation automatique pour les dimanches, fériés et le CIA",
                percent: true,
                automatic: true,
              },
              {
                field: "navigo" as const,
                label: "Navigo remboursé",
                value: navigo,
                hint: "Ex. 68,10",
                use: "hors cumul brut, ajouté tel quel au net",
              },
              {
                field: "mealVoucherDeduction" as const,
                label: "Titres repas (retenue)",
                value: mealVoucherDeduction,
                hint: "Ex. 82,40",
                use: "hors cumul brut, retiré tel quel du net — jamais en décembre",
              },
              {
                field: "pasRate" as const,
                label: "Taux d’imposition (PAS)",
                value: pasRate,
                hint: "Ex. 1,70",
                use: "recopié de la ligne « PAS - Taux » du bulletin — mettez-le à jour si les impôts le changent",
                percent: true,
              },
            ]
          )
            .filter(
              (item) =>
                !isContractuel || (item.field !== "ifse" && item.field !== "cia"),
            )
            .map((item) => (
            <div className="pay-field" key={item.field}>
              <span className="pay-field-head">
                {item.label}
                <b className={item.value ? "" : "pending"}>
                  {item.value
                    ? item.percent
                      ? `${item.value.toLocaleString("fr-FR")} %`
                      : euros(item.value)
                    : "à renseigner"}
                </b>
              </span>
              {/* L'explication ne sert qu'à trouver la ligne sur le bulletin :
                  une fois le montant saisi, elle n'est plus que du bruit. */}
              {item.automatic || !item.value ? <small>{item.use}</small> : null}
              {item.automatic ? (
                <span className="pay-field-automatic">Automatique</span>
              ) : (
              <div className="salary-field">
                <input
                  type="text"
                  inputMode="decimal"
                  className="note-search-input"
                  placeholder={item.hint}
                  value={payDrafts[item.field]}
                  onChange={(event) =>
                    setPayDrafts((current) => ({
                      ...current,
                      [item.field]: event.target.value,
                    }))
                  }
                  aria-label={item.label}
                  title={item.use}
                />
                <button
                  type="button"
                  className="save-button"
                  onClick={() => void savePayAmount(item.field)}
                  disabled={
                    !payDrafts[item.field].trim() || savingPay === item.field
                  }
                  aria-label={`Enregistrer ${item.label}`}
                  title="Enregistrer"
                >
                  {savingPay === item.field ? (
                    "…"
                  ) : (
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="m4 10.5 4 4 8-9" />
                    </svg>
                  )}
                </button>
              </div>
              )}
            </div>
          ))}
          {!isContractuel && (
          <div className="pay-field">
            <span className="pay-field-head">
              Mois du CIA
              <b className={ciaMonth === undefined ? "pending" : ""}>
                {ciaMonth === undefined ? "à renseigner" : MONTHS[ciaMonth]}
              </b>
            </span>
            {ciaMonth === undefined ? (
              <small>versé une seule fois dans l’année</small>
            ) : null}
            <div className="salary-field">
              <ChoicePicker
                value={ciaMonth ?? -1}
                options={[
                  { value: 6, label: "Juillet" },
                  { value: 7, label: "Août" },
                  { value: 8, label: "Septembre" },
                ]}
                onChange={(month) => void saveCiaMonth(month)}
                ariaLabel="Choisir le mois de versement du CIA"
                layout="list"
                className="leave-type-picker cia-month-picker"
                placeholder="À renseigner"
              />
            </div>
          </div>
          )}
          </div>
            </>
          ) : (
            <button
              type="button"
              className="pay-settings-summary"
              onClick={() => setPaySettingsOpen(true)}
            >
              <strong>{missing ? "Des informations restent à renseigner" : "Paramètres enregistrés"}</strong>
              <span>
                {missing
                  ? "Le bulletin PDF peut remplir automatiquement les principaux champs."
                  : "Ouvrir seulement si un montant de votre bulletin change."}
              </span>
            </button>
          )}
        </section>
    </>
  );
}
