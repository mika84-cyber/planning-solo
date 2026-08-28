import { useState } from "react";
import type { LeavePeriod, RequestKind, SelectedDay } from "./appModel";
import type {
  HalfMoment,
  HolidayPay,
  LeaveType,
  MultiDatePerson,
  SelectionType,
} from "./planningLogic";

/** État des fiches jour et des sélections de congés/récupérations. */
export function usePlanningUiState() {
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState("#D3943D");
  const [noteGroupId, setNoteGroupId] = useState("");
  const [noteSelecting, setNoteSelecting] = useState(false);
  const [noteDates, setNoteDates] = useState<string[]>([]);
  const [dayLeave, setDayLeave] = useState(false);
  const [dayPersonalLeave, setDayPersonalLeave] = useState(false);
  const [dayWish, setDayWish] = useState(false);
  const [dayLeaveType, setDayLeaveType] = useState<LeaveType>("annual");
  const [dayHalfMoment, setDayHalfMoment] = useState<HalfMoment>("morning");
  const [dayHolidayPay, setDayHolidayPay] = useState<HolidayPay | "">("");
  const [leaveRangeEnabled, setLeaveRangeEnabled] = useState(false);
  const [leaveRangeFrom, setLeaveRangeFrom] = useState("");
  const [leaveRangeTo, setLeaveRangeTo] = useState("");
  const [savingDay, setSavingDay] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangePrefillDate, setRangePrefillDate] = useState<string | null>(null);
  const [rangeLeaveType, setRangeLeaveType] = useState<LeaveType>("annual");
  const [rangeHalfMoment, setRangeHalfMoment] = useState<HalfMoment>("morning");
  const [rangeSelecting, setRangeSelecting] = useState(false);
  const [separateDates, setSeparateDates] = useState<string[]>([]);
  const [recoveryRangeOpen, setRecoveryRangeOpen] = useState(false);
  const [recoveryRangeSelecting, setRecoveryRangeSelecting] = useState(false);
  const [recoveryRangePrefillDate, setRecoveryRangePrefillDate] = useState<string | null>(null);
  const [recoveryRangeDates, setRecoveryRangeDates] = useState<string[]>([]);
  const [separatePeople, setSeparatePeople] = useState<MultiDatePerson[]>([]);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editingLegacyPeriod, setEditingLegacyPeriod] = useState<LeavePeriod | null>(null);
  const [deletingPeriod, setDeletingPeriod] = useState<LeavePeriod | null>(null);
  const [savingRange, setSavingRange] = useState(false);
  const [requestChooser, setRequestChooser] = useState(false);
  const [planningRequestMethod, setPlanningRequestMethod] = useState<RequestKind | null>(null);
  const [planningRequestDate, setPlanningRequestDate] = useState<string | null>(null);
  const [pendingRecoveryType, setPendingRecoveryType] = useState<SelectionType>("recovery_day");
  const [pendingLeaveType, setPendingLeaveType] = useState<SelectionType>("annual");
  const [requestKind, setRequestKind] = useState<RequestKind | null>(null);
  const [sickRequest, setSickRequest] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [activeType, setActiveType] = useState<SelectionType>("annual");
  const [selections, setSelections] = useState<Record<string, SelectedDay>>({});
  const [timeDate, setTimeDate] = useState<string | null>(null);
  const [timeStart, setTimeStart] = useState("09:15");
  const [timeEnd, setTimeEnd] = useState("13:00");
  const [warningDate, setWarningDate] = useState<string | null>(null);

  return {
    dayDate, setDayDate, noteText, setNoteText, noteColor, setNoteColor,
    noteGroupId, setNoteGroupId, noteSelecting, setNoteSelecting, noteDates, setNoteDates,
    dayLeave, setDayLeave, dayPersonalLeave, setDayPersonalLeave, dayWish, setDayWish,
    dayLeaveType, setDayLeaveType, dayHalfMoment, setDayHalfMoment,
    dayHolidayPay, setDayHolidayPay, leaveRangeEnabled, setLeaveRangeEnabled,
    leaveRangeFrom, setLeaveRangeFrom, leaveRangeTo, setLeaveRangeTo, savingDay, setSavingDay,
    rangeOpen, setRangeOpen, rangePrefillDate, setRangePrefillDate,
    rangeLeaveType, setRangeLeaveType, rangeHalfMoment, setRangeHalfMoment,
    rangeSelecting, setRangeSelecting, separateDates, setSeparateDates,
    recoveryRangeOpen, setRecoveryRangeOpen, recoveryRangeSelecting, setRecoveryRangeSelecting,
    recoveryRangePrefillDate, setRecoveryRangePrefillDate, recoveryRangeDates, setRecoveryRangeDates,
    separatePeople, setSeparatePeople, editingPeriodId, setEditingPeriodId,
    editingLegacyPeriod, setEditingLegacyPeriod, deletingPeriod, setDeletingPeriod,
    savingRange, setSavingRange, requestChooser, setRequestChooser,
    planningRequestMethod, setPlanningRequestMethod, planningRequestDate, setPlanningRequestDate,
    pendingRecoveryType, setPendingRecoveryType, pendingLeaveType, setPendingLeaveType,
    requestKind, setRequestKind, sickRequest, setSickRequest, savingRequest, setSavingRequest,
    activeType, setActiveType, selections, setSelections, timeDate, setTimeDate,
    timeStart, setTimeStart, timeEnd, setTimeEnd, warningDate, setWarningDate,
  };
}
