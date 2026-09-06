import { s } from "./planningLogic";
import { useState } from "react";
import type { PayslipCheckSectionProps } from "./PayslipCheckSection";
import { isPayslipImage, PAYSLIP_FILE_ACCEPT } from "./payslipOcr";

type Props = Pick<
  PayslipCheckSectionProps,
  "importBusy" | "importMode" | "importError" | "onImport" |
  "rateSamples" | "rateCalibration"
>;

export function PayslipCalibrationCard({
  importBusy: payslipImportBusy,
  importMode: payslipImportMode,
  importError: payslipImportError,
  onImport: importPayslips,
  rateSamples: payslipRateSamples,
  rateCalibration: payslipRateCalibration,
}: Props) {
  const [includesPhoto, setIncludesPhoto] = useState(false);
  return (
    <section id="payslip-calibration" className="allowance-card pay-function-card payslip-calibration-card">
      <header>
        <div>
          <span className="step-label">Améliorer la précision</span>
          <h3>Affiner mes estimations</h3>
          <small>Pour remplir automatiquement les éléments de paie</small>
        </div>
        <small>Facultatif</small>
      </header>
      <p className="allowance-note">
        Ajoutez idéalement plusieurs bulletins de mois différents, avec des
        montants de primes variés. L’application remplit automatiquement les
        éléments de paie à partir des PDF ou des photos : aucune saisie
        manuelle n’est nécessaire. Les fichiers ne sont pas conservés.
      </p>
      <label className="payslip-drop payslip-calibration-drop">
        <input
          type="file"
          accept={PAYSLIP_FILE_ACCEPT}
          multiple
          disabled={payslipImportBusy}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length) {
              setIncludesPhoto(files.some(isPayslipImage));
              void importPayslips(files, "calibrate");
            }
          }}
        />
        <span>
          {payslipImportBusy && payslipImportMode === "calibrate"
            ? includesPhoto ? "Reconnaissance des photos…" : "Analyse en cours…"
            : "Choisir plusieurs PDF ou photos"}
        </span>
      </label>
      {payslipImportMode === "calibrate" && payslipImportError ? (
        <p className="allowance-note warn">{payslipImportError}</p>
      ) : null}
      {payslipRateSamples.length ? (
        <div
          className={`payslip-calibration-status ${payslipRateCalibration.reason}`}
          role="status"
        >
          <strong>
            {payslipRateCalibration.reason === "ready"
              ? "Taux affinés automatiquement"
              : payslipRateCalibration.reason === "not-enough-variation"
                ? "Bulletins trop similaires"
                : payslipRateCalibration.reason === "inconsistent"
                  ? "Calcul encore trop incertain"
                  : `${payslipRateCalibration.usableCount} bulletin${s(payslipRateCalibration.usableCount)} utilisable${s(payslipRateCalibration.usableCount)}`}
          </strong>
          <small>
            {payslipRateCalibration.reason === "ready"
              ? "Les taux du traitement et des primes ont été mis à jour."
              : "Il faut au moins deux mois lisibles avec des montants de primes différents."}
          </small>
        </div>
      ) : null}
    </section>
  );
}
