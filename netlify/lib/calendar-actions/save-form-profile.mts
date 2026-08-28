import { json, sanitizeCetAccount, type FormProfile, type ManualYearAdjustments } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleSaveFormProfile(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const fullName =
    typeof body.fullName === "string"
      ? body.fullName.trim().slice(0, 120)
      : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  if (
    signature &&
    (!signature.startsWith("data:image/png;base64,") ||
      signature.length > 600000)
  )
    return json({ error: "Signature invalide" }, 400);
  // Le traitement n'est envoyé que par l'écran qui le modifie : les autres
  // appels (changement de groupe, formulaire) l'ignorent et doivent le
  // laisser intact plutôt que de l'effacer.
  const previousProfile = (await store.get(scopedKey("form-profile"), {
    type: "json",
  })) as FormProfile | null;
  // Même règle pour le groupe : un appel qui ne le renvoie pas ne doit pas
  // effacer le cycle enregistré, qui fausserait ensuite tous les décomptes
  // de dimanches et fériés sans qu'on ait touché au planning.
  const group = ["1", "2", "3"].includes(String(body.group || ""))
    ? String(body.group)
    : previousProfile?.group || "";
  // Même règle qu'ailleurs : un appel qui ne renvoie pas le statut ne doit
  // pas l'effacer.
  const status =
    body.status === "fonctionnaire" || body.status === "contractuel"
      ? body.status
      : previousProfile?.status || "contractuel";
  const workQuota =
    body.workQuota === "full" ||
    body.workQuota === "three_quarters" ||
    body.workQuota === "half"
      ? body.workQuota
      : previousProfile?.work_quota || "full";
  const netRatioRegime =
    body.netRatioRegime === "pre-culture-psc" ||
    body.netRatioRegime === "culture-psc"
      ? body.netRatioRegime
      : previousProfile?.net_ratio_regime;
  const amountCents = (sent: unknown, previous: number | undefined) => {
    if (sent === undefined) return previous;
    const value = Number(sent);
    return Number.isFinite(value) && value >= 0 && value <= 100000000
      ? Math.round(value)
      : undefined;
  };
  // Un taux net/brut, en points de base : borné à 100 % (10000), pas au
  // même plafond très large qu'un montant en centimes.
  const ratioBp = (sent: unknown, previous: number | undefined) => {
    if (sent === undefined) return previous;
    const value = Number(sent);
    return Number.isFinite(value) && value >= 0 && value <= 10000
      ? Math.round(value)
      : undefined;
  };
  const formProfile: FormProfile = {
    full_name: fullName,
    group,
    signature,
    status,
    work_quota: workQuota,
    base_salary_cents: amountCents(
      body.baseSalaryCents,
      previousProfile?.base_salary_cents,
    ),
    residence_allowance_cents: amountCents(
      body.residenceAllowanceCents,
      previousProfile?.residence_allowance_cents,
    ),
    ifse_cents: amountCents(body.ifseCents, previousProfile?.ifse_cents),
    carence_cents: amountCents(
      body.carenceCents,
      previousProfile?.carence_cents,
    ),
    other_fixed_cents: amountCents(
      body.otherFixedCents,
      previousProfile?.other_fixed_cents,
    ),
    cia_cents: amountCents(body.ciaCents, previousProfile?.cia_cents),
    net_ratio_fixed_bp: ratioBp(
      body.netRatioFixedBp,
      previousProfile?.net_ratio_fixed_bp,
    ),
    net_ratio_variable_bp: ratioBp(
      body.netRatioVariableBp,
      previousProfile?.net_ratio_variable_bp,
    ),
    net_ratio_regime: netRatioRegime,
    navigo_cents: amountCents(body.navigoCents, previousProfile?.navigo_cents),
    meal_voucher_deduction_cents: amountCents(
      body.mealVoucherDeductionCents,
      previousProfile?.meal_voucher_deduction_cents,
    ),
    pas_rate_bp: ratioBp(body.pasRateBp, previousProfile?.pas_rate_bp),
    // Juillet, août ou septembre : les trois mois où le CIA est réellement
    // tombé entre 2024 et 2026 (septembre en 2024, août en 2025, juillet en
    // 2026).
    cia_month:
      body.ciaMonth === undefined
        ? previousProfile?.cia_month
        : body.ciaMonth === 6 || body.ciaMonth === 7 || body.ciaMonth === 8
          ? body.ciaMonth
          : undefined,
    sunday_carryover:
      body.sundayCarryover === undefined
        ? previousProfile?.sunday_carryover
        : Number.isFinite(Number(body.sundayCarryover)) &&
            Number(body.sundayCarryover) >= 0
          ? Math.round(Number(body.sundayCarryover))
          : undefined,
    sunday_carryover_year:
      body.sundayCarryoverYear === undefined
        ? previousProfile?.sunday_carryover_year
        : Number.isFinite(Number(body.sundayCarryoverYear))
          ? Number(body.sundayCarryoverYear)
          : undefined,
    sunday_carryover_month:
      body.sundayCarryoverMonth === undefined
        ? previousProfile?.sunday_carryover_month
        : Number.isFinite(Number(body.sundayCarryoverMonth)) &&
            Number(body.sundayCarryoverMonth) >= 0 &&
            Number(body.sundayCarryoverMonth) <= 11
          ? Number(body.sundayCarryoverMonth)
          : undefined,
    sunday_carryover_from_year:
      body.sundayCarryoverFromYear === undefined
        ? previousProfile?.sunday_carryover_from_year
        : Number.isFinite(Number(body.sundayCarryoverFromYear))
          ? Number(body.sundayCarryoverFromYear)
          : undefined,
    sunday_carryover_from_month:
      body.sundayCarryoverFromMonth === undefined
        ? previousProfile?.sunday_carryover_from_month
        : Number.isFinite(Number(body.sundayCarryoverFromMonth)) &&
            Number(body.sundayCarryoverFromMonth) >= 0 &&
            Number(body.sundayCarryoverFromMonth) <= 11
          ? Number(body.sundayCarryoverFromMonth)
          : undefined,
    pay_profiles: previousProfile?.pay_profiles,
    manual_adjustments: previousProfile?.manual_adjustments,
    cet_account: previousProfile?.cet_account,
    updated_at: new Date().toISOString(),
  };
  if (body.cetAccount !== undefined) {
    const cetAccount = sanitizeCetAccount(body.cetAccount);
    if (!cetAccount) return json({ error: "Compte épargne-temps invalide" }, 400);
    formProfile.cet_account = cetAccount;
  }
  const manualYear = Number(body.manualYear);
  if (body.manualYear !== undefined) {
    if (!Number.isInteger(manualYear) || manualYear < 2000 || manualYear > 2100)
      return json({ error: "Année de rattrapage invalide" }, 400);
    const leaveValue = (value: unknown, maximum: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum &&
        Number.isInteger(parsed * 2)
        ? parsed
        : null;
    };
    const sundayValue = (value: unknown) => {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 0 && parsed <= 53
        ? parsed
        : null;
    };
    const manual: ManualYearAdjustments = {
      annual_used: leaveValue(body.manualAnnualUsed, 29) as number,
      rtt_used: leaveValue(body.manualRttUsed, 15) as number,
      fraction_used: leaveValue(body.manualFractionUsed, 2) as number,
      sunday_leave_jan_jun: sundayValue(body.manualSundayLeaveJanJun) as number,
      sunday_leave_jul_sep: sundayValue(body.manualSundayLeaveJulSep) as number,
      sunday_leave_oct_nov: sundayValue(body.manualSundayLeaveOctNov) as number,
      sunday_leave_dec: sundayValue(body.manualSundayLeaveDec) as number,
    };
    if (Object.values(manual).some((value) => value === null))
      return json({ error: "Valeurs de rattrapage invalides" }, 400);
    formProfile.manual_adjustments = {
      ...(previousProfile?.manual_adjustments || {}),
      [String(manualYear)]: manual,
    };
  }
  const payYear = Number(body.payYear);
  if (Number.isInteger(payYear) && payYear >= 2000 && payYear <= 2100) {
    const key = String(payYear);
    const previousYear = previousProfile?.pay_profiles?.[key] || {
      base_salary_cents: previousProfile?.base_salary_cents,
      residence_allowance_cents: previousProfile?.residence_allowance_cents,
      ifse_cents: previousProfile?.ifse_cents,
      carence_cents: previousProfile?.carence_cents,
      other_fixed_cents: previousProfile?.other_fixed_cents,
      cia_cents: previousProfile?.cia_cents,
      cia_month: previousProfile?.cia_month,
      net_ratio_fixed_bp: previousProfile?.net_ratio_fixed_bp,
      net_ratio_variable_bp: previousProfile?.net_ratio_variable_bp,
      net_ratio_regime: previousProfile?.net_ratio_regime,
      navigo_cents: previousProfile?.navigo_cents,
      meal_voucher_deduction_cents:
        previousProfile?.meal_voucher_deduction_cents,
      pas_rate_bp: previousProfile?.pas_rate_bp,
    };
    formProfile.pay_profiles = {
      ...(previousProfile?.pay_profiles || {}),
      [key]: {
        base_salary_cents: amountCents(
          body.baseSalaryCents,
          previousYear.base_salary_cents,
        ),
        residence_allowance_cents: amountCents(
          body.residenceAllowanceCents,
          previousYear.residence_allowance_cents,
        ),
        ifse_cents: amountCents(body.ifseCents, previousYear.ifse_cents),
        carence_cents: amountCents(
          body.carenceCents,
          previousYear.carence_cents,
        ),
        other_fixed_cents: amountCents(
          body.otherFixedCents,
          previousYear.other_fixed_cents,
        ),
        cia_cents: amountCents(body.ciaCents, previousYear.cia_cents),
        cia_month:
          body.ciaMonth === undefined
            ? previousYear.cia_month
            : body.ciaMonth === 6 ||
                body.ciaMonth === 7 ||
                body.ciaMonth === 8
              ? body.ciaMonth
              : undefined,
        net_ratio_fixed_bp: ratioBp(
          body.netRatioFixedBp,
          previousYear.net_ratio_fixed_bp,
        ),
        net_ratio_variable_bp: ratioBp(
          body.netRatioVariableBp,
          previousYear.net_ratio_variable_bp,
        ),
        net_ratio_regime:
          body.netRatioRegime === "pre-culture-psc" ||
          body.netRatioRegime === "culture-psc"
            ? body.netRatioRegime
            : previousYear.net_ratio_regime,
        navigo_cents: amountCents(
          body.navigoCents,
          previousYear.navigo_cents,
        ),
        meal_voucher_deduction_cents: amountCents(
          body.mealVoucherDeductionCents,
          previousYear.meal_voucher_deduction_cents,
        ),
        pas_rate_bp: ratioBp(body.pasRateBp, previousYear.pas_rate_bp),
      },
    };
    const payMonth = Number(body.payMonth);
    if (
      Number.isInteger(payMonth) &&
      payMonth >= 0 &&
      payMonth <= 11 &&
      (body.baseSalaryCents !== undefined ||
        body.residenceAllowanceCents !== undefined)
    ) {
      const monthKey = `${payYear}-${String(payMonth + 1).padStart(2, "0")}`;
      const previousMonth = previousProfile?.pay_profiles?.[monthKey] || {};
      formProfile.pay_profiles[monthKey] = {
        ...previousMonth,
        base_salary_cents: amountCents(
          body.baseSalaryCents,
          previousMonth.base_salary_cents,
        ),
        residence_allowance_cents: amountCents(
          body.residenceAllowanceCents,
          previousMonth.residence_allowance_cents,
        ),
      };
    }
    if (Array.isArray(body.monthlyPayProfiles)) {
      for (const rawMonthly of body.monthlyPayProfiles.slice(0, 24)) {
        if (!rawMonthly || typeof rawMonthly !== "object") continue;
        const monthly = rawMonthly as Record<string, unknown>;
        const monthlyYear = Number(monthly.year);
        const monthlyMonth = Number(monthly.month);
        if (
          !Number.isInteger(monthlyYear) ||
          monthlyYear < 2000 ||
          monthlyYear > 2100 ||
          !Number.isInteger(monthlyMonth) ||
          monthlyMonth < 0 ||
          monthlyMonth > 11
        )
          continue;
        const monthKey = `${monthlyYear}-${String(monthlyMonth + 1).padStart(2, "0")}`;
        const previousMonth = formProfile.pay_profiles[monthKey] || {};
        formProfile.pay_profiles[monthKey] = {
          ...previousMonth,
          base_salary_cents: amountCents(
            monthly.baseSalaryCents,
            previousMonth.base_salary_cents,
          ),
          residence_allowance_cents: amountCents(
            monthly.residenceAllowanceCents,
            previousMonth.residence_allowance_cents,
          ),
        };
      }
    }
  }
  await store.setJSON(scopedKey("form-profile"), formProfile);
  return json({ ok: true, form_profile: formProfile });
}
