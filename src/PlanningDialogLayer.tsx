import { type ComponentProps, type Dispatch, lazy, type SetStateAction, Suspense } from "react";
import type { BalanceType, RequestKind } from "./appModel";
import { cetBalance } from "./cet";
import { type CountedOnlyType, dateKey, localDate, type SelectionType } from "./planningLogic";
import { strikeEstimateForCalendarMonth } from "./strike";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { useCalendarDataState } from "./useCalendarDataState";
import type { useDayDetailData } from "./useDayDetailData";
import { remainingLeaveForYear, type useLeaveBalances } from "./useLeaveBalances";
import type { useMonthPayEstimate } from "./useMonthPayEstimate";
import type { usePartnerNoteActions } from "./usePartnerNoteActions";
import type { usePayProfileValues } from "./usePayProfileValues";
import type { usePlanningEditorActions } from "./usePlanningEditorActions";
import type { usePlanningEntryActions } from "./usePlanningEntryActions";
import type { usePlanningInteractionActions } from "./usePlanningInteractionActions";
import type { usePlanningUiState } from "./usePlanningUiState";
import type { useProfileAdjustmentActions } from "./useProfileAdjustmentActions";
import type { useWorkExchangeActions } from "./useWorkExchangeActions";
import type { useWorkProfileActions } from "./useWorkProfileActions";
import type { useWorkTimeActions } from "./useWorkTimeActions";

const DayDetailDialog = lazy(() => import("./DayDetailDialog").then((module) => ({ default: module.DayDetailDialog })));
// « Faire un échange » ne sert qu'à la demande : chargée à l'ouverture.
const WorkExchangeDialog = lazy(() => import("./WorkExchangeDialog").then((module) => ({ default: module.WorkExchangeDialog })));
const BalanceDetailDialog = lazy(() =>
  import("./BalanceDetailDialog").then(({ BalanceDetailDialog: Component }) => ({ default: Component })),
);
const planningRequestPanelsModule = () => import("./PlanningRequestPanels");
const GroupChooserDialog = lazy(() =>
  planningRequestPanelsModule().then(({ GroupChooserDialog: Component }) => ({ default: Component })),
);
const WishConversionDialog = lazy(() =>
  planningRequestPanelsModule().then(({ WishConversionDialog: Component }) => ({ default: Component })),
);
const RequestChooserDialog = lazy(() =>
  planningRequestPanelsModule().then(({ RequestChooserDialog: Component }) => ({ default: Component })),
);

type DayDetailProps = ComponentProps<typeof DayDetailDialog>;

type Props = {
  now: Date;
  group: number;
  demoMode: boolean;
  /** Année des soldes affichés dans la page Congés. */
  absenceYear: number;
  ownNoteAuthorLabel: string;
  setView: Dispatch<SetStateAction<Date>>;
  calendar: Pick<
    ReturnType<typeof useCalendarDataState>,
    "entries" | "periods" | "formProfile" | "payProfiles" | "recoveryUses" | "partnerEntries"
  >;
  /** L'état du planning, lu en entier par la fiche du jour. */
  planning: ReturnType<typeof usePlanningUiState>;
  shell: Pick<
    ReturnType<typeof useAppShellUiState>,
    "quickNoteMode" | "approvedGrandPalaisUpdates" | "groupChooserOpen" | "setGroupChooserOpen"
  >;
  exchange: Pick<
    ReturnType<typeof useWorkExchangeActions>,
    "open" | "draft" | "setDraft" | "error" | "saving" | "close" | "save" | "remove" | "openEdit"
  >;
  /** Soldes proposés au choix d'une demande et détail d'un solde ouvert. */
  balances: Pick<
    ReturnType<typeof useLeaveBalances>,
    "cetPlannedLeaveDays" | "balanceDetail" | "balanceDetailPeriods" | "recentBalanceDetailDates"
  > & Pick<ReturnType<typeof useMonthPayEstimate>, "recoveryBalance"> & {
    balanceDetailType: BalanceType | CountedOnlyType | null;
    setBalanceDetailType: Dispatch<SetStateAction<BalanceType | CountedOnlyType | null>>;
  };
  /** Souhaits posés, à venir, et ceux en cours de transformation. */
  wishes: {
    wishDates: ReadonlySet<string>;
    pendingWishDates: string[];
    wishConversionDates: string[] | null;
    setWishConversionDates: Dispatch<SetStateAction<string[] | null>>;
  };
  /** Ce que la fiche du jour montre, et son champ de note. */
  day: ReturnType<typeof useDayDetailData> & {
    noteEditorOpen: boolean;
    setNoteEditorOpen: Dispatch<SetStateAction<boolean>>;
    noteFieldRef: DayDetailProps["noteFieldRef"];
    appendNoteLine: () => void;
  };
  pay: Pick<ReturnType<typeof usePayProfileValues>, "baseSalary" | "deductionPayMonths">;
  actions: Pick<
    ReturnType<typeof usePlanningInteractionActions>,
    "openDay" | "beginWishSelection" | "beginWishConversion" | "beginMultipleDateSelectionFromDay" | "beginNoteDateSelection"
  >
    & Pick<ReturnType<typeof usePlanningEntryActions>, "saveWishDateDirect">
    & Pick<ReturnType<typeof usePlanningEditorActions>, "saveDay" | "saveWorkPost" | "editDayLeavePeriod">
    & Pick<ReturnType<typeof useWorkTimeActions>, "deleteRecoveryUse" | "deleteOvertimeEntry">
    & Pick<ReturnType<typeof usePartnerNoteActions>, "deleteAgnesNote">
    & Pick<ReturnType<typeof useProfileAdjustmentActions>, "openManualAdjustments">
    & Pick<ReturnType<typeof useWorkProfileActions>, "changeGroup">
    & {
      openRequestChooser: (origin?: "general" | "planning", initialDate?: string) => void;
      beginChosenRequest: (kind: RequestKind, requestedType: SelectionType) => void;
    };
};

/**
 * Les fenêtres du planning : l'échange, le choix d'une demande, la
 * transformation des souhaits, le groupe, la fiche du jour et le détail d'un
 * solde. Chacune se charge à l'ouverture ; les états et les actions restent
 * dans App.tsx, ce composant les relie aux fenêtres.
 */
export function PlanningDialogLayer({
  now, group, demoMode, absenceYear, ownNoteAuthorLabel, setView,
  calendar, planning, shell, exchange, balances, wishes, day, pay, actions,
}: Props) {
  const { entries, periods, formProfile, payProfiles, recoveryUses, partnerEntries } = calendar;
  const planningUi = planning;
  const { dayDate, setDayDate, requestChooser, setRequestChooser, requestChooserDate, setRequestChooserDate } = planning;
  const { quickNoteMode, approvedGrandPalaisUpdates, groupChooserOpen, setGroupChooserOpen } = shell;
  const workExchangeUi = exchange;
  const { openEdit: editWorkExchange } = exchange;
  const {
    cetPlannedLeaveDays, balanceDetail, balanceDetailPeriods, recentBalanceDetailDates,
    recoveryBalance, balanceDetailType, setBalanceDetailType,
  } = balances;
  const { wishDates, pendingWishDates, wishConversionDates, setWishConversionDates } = wishes;
  const {
    dayHolidayChoiceVisible, dayStoredPeriods, dayRecoveryUses, dayOvertime,
    dayExceptionalClosure, dayExchange, dayWorkPostVisible,
    noteEditorOpen, setNoteEditorOpen, noteFieldRef, appendNoteLine,
  } = day;
  const { baseSalary, deductionPayMonths } = pay;
  const {
    openDay, beginWishSelection, beginWishConversion, beginMultipleDateSelectionFromDay, beginNoteDateSelection,
    saveWishDateDirect, saveDay, saveWorkPost, editDayLeavePeriod, deleteRecoveryUse, deleteOvertimeEntry,
    deleteAgnesNote, openManualAdjustments, changeGroup, openRequestChooser, beginChosenRequest,
  } = actions;
  return (
    <>
      {workExchangeUi.open ? (
        <Suspense fallback={null}>
          <WorkExchangeDialog
            open
            demoMode={demoMode}
            group={group}
            draft={workExchangeUi.draft}
            setDraft={workExchangeUi.setDraft}
            error={workExchangeUi.error}
            saving={workExchangeUi.saving}
            onClose={workExchangeUi.close}
            onSave={(fillForm) => void workExchangeUi.save(fillForm)}
            onDelete={() => void workExchangeUi.remove()}
          />
        </Suspense>
      ) : null}
      {requestChooser ? (
        <Suspense fallback={null}>
        <RequestChooserDialog
          open={requestChooser}
          requestChooserDate={requestChooserDate}
          balances={(() => {
            // Soldes de l'année de la case touchée, ou de l'année en cours.
            const year = Number((requestChooserDate || dateKey(now)).slice(0, 4));
            return {
              year,
              otherYear: year !== now.getFullYear(),
              leave: remainingLeaveForYear(year, now, periods, group, formProfile?.manualAdjustments),
              recoveryMinutes: recoveryBalance.remaining,
              cetDays: formProfile?.cetAccount?.enabled
                ? Math.max(0, cetBalance(formProfile.cetAccount) - cetPlannedLeaveDays)
                : null,
            };
          })()}
          // « Transformer mes souhaits » ne s'offre que depuis une case souhaitée.
          pendingWishCount={requestChooserDate && wishDates.has(requestChooserDate) ? pendingWishDates.length : 0}
          onClose={() => setRequestChooser(false)}
          onChoose={beginChosenRequest}
          onChooseWish={() => {
            const initialDate = requestChooserDate || undefined;
            setRequestChooserDate(null);
            beginWishSelection(initialDate);
          }}
          onConvertWishes={() => {
            setRequestChooser(false);
            setRequestChooserDate(null);
            setWishConversionDates(pendingWishDates);
          }}
        />
        </Suspense>
      ) : null}

      {wishConversionDates?.length ? (
        <Suspense fallback={null}>
        <WishConversionDialog
          dates={wishConversionDates}
          moments={Object.fromEntries(wishConversionDates.map((date) => [date, entries[date]?.wishMoment]))}
          onClose={() => setWishConversionDates(null)}
          onContinue={(types, cancelled) => {
            setWishConversionDates(null);
            if (Object.keys(types).length)
              beginWishConversion(
                Object.keys(types).sort(),
                types,
                Object.fromEntries(Object.keys(types).map((date) => [date, entries[date]?.wishMoment])),
              );
            // Les souhaits annulés sont retirés un à un du planning.
            void (async () => {
              for (const date of cancelled) await saveWishDateDirect(date, false);
            })();
          }}
        />
        </Suspense>
      ) : null}

      {groupChooserOpen ? (
        <Suspense fallback={null}>
        <GroupChooserDialog
          open={groupChooserOpen}
          group={group}
          onClose={() => setGroupChooserOpen(false)}
          onChange={(value) => {
            changeGroup(value);
            setGroupChooserOpen(false);
          }}
        />
        </Suspense>
      ) : null}

      {/* La fiche du jour se charge à la première ouverture ; elle est
          préchargée dès que l’application est prête. */}
      {dayDate ? (
        <Suspense fallback={null}>
          <DayDetailDialog
            planning={planningUi}
            quickNoteMode={quickNoteMode}
            entries={entries}
            partnerEntries={partnerEntries}
            dayExchange={dayExchange}
            exchangeGroup={group}
            dayStoredPeriods={dayStoredPeriods}
            dayRecoveryUses={dayRecoveryUses}
            dayOvertime={dayOvertime}
            dayExceptionalClosure={Boolean(dayExceptionalClosure)}
            dayHolidayChoiceVisible={dayHolidayChoiceVisible}
            dayWorkPostVisible={dayWorkPostVisible}
            baseSalary={baseSalary}
            approvedGrandPalaisUpdates={approvedGrandPalaisUpdates}
            noteEditorOpen={noteEditorOpen}
            setNoteEditorOpen={setNoteEditorOpen}
            noteFieldRef={noteFieldRef}
            ownNoteAuthorLabel={ownNoteAuthorLabel}
            editWorkExchange={editWorkExchange}
            openRequestChooser={openRequestChooser}
            saveWishDateDirect={saveWishDateDirect}
            convertWishDate={(date) => {
              setDayDate(null);
              setWishConversionDates([date]);
            }}
            pendingWishCount={pendingWishDates.length}
            convertAllWishes={() => {
              setDayDate(null);
              setWishConversionDates(pendingWishDates);
            }}
            saveDay={saveDay}
            saveWorkPost={saveWorkPost}
            beginMultipleDateSelectionFromDay={beginMultipleDateSelectionFromDay}
            beginNoteDateSelection={beginNoteDateSelection}
            editDayLeavePeriod={editDayLeavePeriod}
            deleteRecoveryUse={deleteRecoveryUse}
            deleteOvertimeEntry={deleteOvertimeEntry}
            deleteAgnesNote={deleteAgnesNote}
            appendNoteLine={appendNoteLine}
          />
        </Suspense>
      ) : null}

      {balanceDetail ? (
        <Suspense fallback={null}>
        <BalanceDetailDialog
          balanceDetail={balanceDetail}
          balanceDetailType={balanceDetailType}
          balanceDetailPeriods={balanceDetailPeriods}
          recentBalanceDetailDates={recentBalanceDetailDates}
          absenceYear={absenceYear}
          now={now}
          onClose={() => setBalanceDetailType(null)}
          onOpenDate={(date) => {
            setBalanceDetailType(null);
            setView(localDate(date.getFullYear(), date.getMonth(), 1));
            openDay(date);
          }}
          onOpenManualAdjustments={openManualAdjustments}
          strikeEstimateFor={(year, monthIndex) =>
            strikeEstimateForCalendarMonth(
              periods,
              group,
              payProfiles,
              year,
              monthIndex,
              { entries, recoveryUses },
              deductionPayMonths,
            )
          }
        />
        </Suspense>
      ) : null}
    </>
  );
}
