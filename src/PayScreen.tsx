import type { ComponentProps } from "react";
import { PayAllowancesSection, PayPage } from "./appSections";
import { buildPayContent, type PayContentInput } from "./payContent";

type PayPageProps = ComponentProps<typeof PayPage>;
type AllowancesProps = ComponentProps<typeof PayAllowancesSection>;

type PayScreenProps = {
  /** Tout ce que la page lit du calcul du mois (voir src/payContent.tsx). */
  content: PayContentInput;
  allowances: AllowancesProps["allowances"];
  holidayChoiceEditing: AllowancesProps["holidayChoiceEditing"];
  onEditHolidayChoice: AllowancesProps["onEditHolidayChoice"];
  onChooseHolidayPay: AllowancesProps["onChooseHolidayPay"];
  onExchangeHoliday: AllowancesProps["onExchangeHoliday"];
  /** Les réglages de la page qui ne viennent pas du calcul : écran ouvert,
   *  profil, animation du mois et actions. */
  page: Omit<
    PayPageProps,
    | "month" | "year" | "gross" | "grossComplete" | "net" | "reliability" | "variables"
    | "calculation" | "allowancesPending" | "verification" | "savedVerification" | "deductionContent"
    | "allowancesContent" | "estimateContent" | "verificationContent" | "settingsContent"
  >;
};

/**
 * La rubrique Ma paie : le contenu du mois est construit ici, à l'ouverture
 * de la rubrique seulement, et la page le reçoit avec la carte des primes.
 * Chargée à part d'App.tsx, avec payContent.tsx et les sources de retenues.
 */
export function PayScreen({
  content,
  allowances,
  holidayChoiceEditing,
  onEditHolidayChoice,
  onChooseHolidayPay,
  onExchangeHoliday,
  page,
}: PayScreenProps) {
  const payContent = buildPayContent(content);
  const { payView } = content.payUi;
  // Sans primes calculées, la rubrique n'affiche rien, comme avant.
  if (!payContent) return null;
  /** Le volet de vérification d'un bulletin, séparé des primes : on y va pour
   *  contrôler, pas pour consulter. */
  const allowancesContent = (
    <PayAllowancesSection
      allowances={allowances}
      monthPay={content.monthPay}
      overtimeForPayMonth={content.overtimeForPayMonth}
      mecenatForPayMonth={content.mecenatForCurrentPayMonth}
      strikeForPayMonth={content.strikeForCurrentPayMonth}
      isContractuel={content.isContractuel}
      baseSalary={content.baseSalary}
      month={payView.getMonth()}
      year={payView.getFullYear()}
      holidayChoiceEditing={holidayChoiceEditing}
      onChangeMonth={content.changePayMonth}
      onGoToday={content.goPayToday}
      onEditHolidayChoice={onEditHolidayChoice}
      onChooseHolidayPay={onChooseHolidayPay}
      onExchangeHoliday={onExchangeHoliday}
    />
  );
  return (
    <PayPage
      {...page}
      month={payView.getMonth()}
      year={payView.getFullYear()}
      gross={payContent.gross}
      grossComplete={payContent.grossComplete}
      net={payContent.net}
      reliability={payContent.reliability}
      variables={payContent.variables}
      calculation={payContent.calculation}
      allowancesPending={payContent.allowancesPending}
      verification={payContent.verification}
      savedVerification={payContent.savedVerification}
      deductionContent={payContent.deductionContent}
      allowancesContent={allowancesContent}
      estimateContent={payContent.estimateContent}
      verificationContent={payContent.verificationContent}
      settingsContent={payContent.settingsContent}
    />
  );
}
