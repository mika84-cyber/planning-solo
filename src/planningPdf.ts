import { jsPDF } from "jspdf";
import { workedHolidaysYearRange } from "./planningLogic";

type PdfDayInfo = {
  kind: "work" | "off" | "training";
  holiday: string;
};
type PdfColor = readonly [number, number, number];
type PdfLeaveType =
  | "annual"
  | "rtt"
  | "fraction"
  | "half"
  | "recovery"
  | "sick"
  | "strike"
  | "cet"
  | "other"
  | "childcare"
  | "exceptional"
  | "work_accident";
/** Moitié posée sur une demi-journée. Absent pour les demi-journées venues du
 *  formulaire, qui n'en portent pas : la case est alors coloriée à gauche. */
type PdfHalfMoment = "morning" | "afternoon";
export type PdfExchangeMarker = {
  number: number;
  role: "given" | "return";
};
type PlanningPdfAssets = {
  exchange?: string;
  /** Flèches et dollar : l'échange d'un jour férié. */
  holidayExchange?: string;
  workAccident?: string;
};
const LEAVE_CODES: Record<Exclude<PdfLeaveType, "half">, string> = {
  annual: "CA",
  rtt: "RTT",
  fraction: "Fraction.",
  recovery: "Récup",
  sick: "Maladie",
  strike: "Grève",
  cet: "CET",
  other: "Divers",
  childcare: "Garde enf.",
  exceptional: "ASA",
  work_accident: "AT",
};

type PlanningPdfOptions = {
  year: number;
  groups: number[];
  getDayInfo: (date: Date, group: number) => PdfDayInfo;
  wasPompidouHolidayWorked: (date: Date, group: number) => boolean;
  leaveTypes?: ReadonlyMap<string, PdfLeaveType>;
  /** Moitié posée, jour par jour, pour les seules demi-journées. */
  halfMoments?: ReadonlyMap<string, PdfHalfMoment>;
  /** Solde des demi-journées de RTT et de fractionnement ; les autres sont
   *  des demi-journées de congés annuels. */
  halfBalances?: ReadonlyMap<string, "rtt" | "fraction" | "exceptional" | "other">;
  leaveSummary?: { used: number; remaining: number };
  schoolVacationDates?: ReadonlySet<string>;
  /** Congés souhaités, pas encore validés : leur case est verte. */
  wishDates?: ReadonlySet<string>;
  /** Fermetures visibles dans l'application, y compris les corrections locales. */
  closedDates?: ReadonlySet<string>;
  /** Même numéro sur les deux journées qui composent un échange. */
  exchangeMarkers?: ReadonlyMap<string, PdfExchangeMarker>;
  /** Images déjà converties en PNG par le navigateur. */
  assets?: PlanningPdfAssets;
  /** Vacances scolaires de l'année, regroupées dans les trois zones. */
  schoolVacationsByZone?: Record<
    "A" | "B" | "C",
    Array<{ name: string; from: string; to: string }>
  >;
  /** La légende détaillée n'est utile que dans le planning avec congés. */
  showColorLegend?: boolean;
  /** Pied de page du planning sans congés : l'ancien résumé en carte, ou un
   *  bandeau fin sur toute la largeur (par défaut). */
  footerStyle?: PlainFooterStyle;
  filenameLabel?: string;
};

export type PlainFooterStyle = "summary" | "band";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const WEEKDAYS = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];

const COLORS = {
  black: [0, 0, 0] as const,
  white: [255, 255, 255] as const,
  training: [180, 180, 180] as const,
  holiday: [244, 166, 116] as const,
  month: [220, 220, 220] as const,
  red: [245, 35, 35] as const,
  yearHeader: [66, 174, 211] as const,
  yearValue: [218, 241, 249] as const,
  groupHeader: [105, 184, 74] as const,
  groupValue: [226, 243, 219] as const,
  holidaysHeader: [242, 154, 98] as const,
  holidaysValue: [252, 226, 210] as const,
  leave: [108, 189, 240] as const,
  rtt: [242, 185, 80] as const,
  fraction: [201, 166, 234] as const,
  /** Récupération : violet doux. Elle ne se décompte pas comme un congé, donc
   *  elle ne reprend pas son bleu. */
  recovery: [206, 189, 240] as const,
  /** Barre des vacances scolaires, dans la marge gauche de la colonne. */
  schoolVacation: [32, 185, 107] as const,
  /** Fond des congés souhaités : vert clair, pour rester lisible sous le
   *  texte noir des dates. */
  wish: [122, 211, 156] as const,
  workAccident: [255, 216, 48] as const,
  money: [242, 174, 39] as const,
  /** Bleu ardoise du tableau des vacances : sobre, il ferme la page sans
   *  reprendre une couleur déjà porteuse de sens dans la grille. */
  slate: [45, 62, 84] as const,
  slateLine: [214, 223, 235] as const,
};

function leaveFill(leaveType: PdfLeaveType | undefined) {
  // Ces quatre catégories reprennent exactement les aplats du calendrier de
  // l'application. Les autres congés validés conservent le bleu commun.
  if (leaveType === "strike") return [242, 139, 130] as const;
  if (leaveType === "other") return [244, 184, 200] as const;
  return COLORS.leave;
}

const EMOJI_LEAVE_TYPES = new Set<PdfLeaveType>([
  "sick",
  "strike",
  "other",
  "childcare",
]);

const LEAVE_EMOJIS: Partial<Record<PdfLeaveType, string>> = {
  sick: "🤒",
  strike: "✊",
  other: "📌",
  childcare: "👶",
};
const emojiImageCache = new Map<string, string>();

async function loadPdfAsset(path: string) {
  if (typeof document === "undefined" || typeof Image === "undefined") return undefined;
  return new Promise<string | undefined>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maximumSize = 256;
      const scale = Math.min(1, maximumSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return resolve(undefined);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(undefined);
    image.src = path;
  });
}

/** Charge une seule fois les pictogrammes réellement employés dans le planning. */
export async function loadPlanningPdfAssets(): Promise<PlanningPdfAssets> {
  const [exchange, holidayExchange, workAccident] = await Promise.all([
    loadPdfAsset("/exchange-arrows.png"),
    loadPdfAsset("/holiday-exchange.png"),
    loadPdfAsset("/work-accident-icon.png"),
  ]);
  return { exchange, holidayExchange, workAccident };
}

function drawAsset(
  doc: jsPDF,
  image: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  alias: string,
) {
  if (!image) return false;
  try {
    doc.addImage(image, "PNG", x, y, width, height, alias, "FAST");
    return true;
  } catch {
    return false;
  }
}

function drawWorkAccidentMarker(
  doc: jsPDF,
  image: string | undefined,
  centerX: number,
  centerY: number,
) {
  if (drawAsset(doc, image, centerX - 2.1, centerY - 2.1, 4.2, 4.2, "work-accident-marker")) return;
  doc.setFillColor(12, 132, 232);
  doc.setDrawColor(9, 33, 62);
  doc.circle(centerX, centerY, 1.75, "FD");
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.2);
  doc.text("AT", centerX, centerY, { align: "center", baseline: "middle" });
}

function drawExchangeMarker(
  doc: jsPDF,
  image: string | undefined,
  centerX: number,
  centerY: number,
  number: number,
  scale = 1,
  alias = "exchange-marker",
) {
  const k = scale;
  // Une étiquette blanche cerclée de turquoise : la pastille des flèches, puis
  // le numéro de l'échange en brun foncé, comme sur le planning de l'appli.
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(94, 182, 196);
  doc.setLineWidth(0.3 * k);
  doc.roundedRect(centerX - 4.1 * k, centerY - 2.05 * k, 8.2 * k, 4.1 * k, 2.05 * k, 2.05 * k, "FD");
  if (!drawAsset(doc, image, centerX - 3.65 * k, centerY - 1.6 * k, 3.2 * k, 3.2 * k, alias)) {
    doc.setFillColor(43, 133, 147);
    doc.circle(centerX - 2.05 * k, centerY, 1.55 * k, "F");
  }
  doc.setFillColor(44, 38, 33);
  doc.circle(centerX + 2.15 * k, centerY, 1.45 * k, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize((number > 9 ? 3.3 : 4.2) * k);
  doc.text(String(number), centerX + 2.15 * k, centerY, { align: "center", baseline: "middle" });
}

function drawClosedFrame(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = true,
) {
  if (fill) doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.28);
  doc.rect(x, y, width, height, fill ? "FD" : "S");
}

function paintColorRuns(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  rowHeight: number,
  colors: PdfColor[],
) {
  let runStart = 0;
  const transitions: number[] = [];
  for (let index = 1; index <= colors.length; index++) {
    const previous = colors[index - 1];
    const current = colors[index];
    if (current && current.every((value, channel) => value === previous[channel])) continue;
    doc.setFillColor(...previous);
    doc.rect(x, y + runStart * rowHeight, width, (index - runStart) * rowHeight, "F");
    if (current) transitions.push(index);
    runStart = index;
  }
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.28);
  transitions.forEach((index) => {
    const separatorY = y + index * rowHeight;
    doc.line(x, separatorY, x + width, separatorY);
  });
}

function isBlackColor(color: PdfColor) {
  return color.every((value, channel) => value === COLORS.black[channel]);
}

/** Capture l'emoji avec la police couleur réellement utilisée par l'appareil.
 *  Le rendu du PDF reprend ainsi le même dessin que le planning affiché. */
function leaveEmojiImage(leaveType: PdfLeaveType) {
  const emoji = LEAVE_EMOJIS[leaveType];
  if (!emoji || typeof document === "undefined") return "";
  const cached = emojiImageCache.get(emoji);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font =
    '72px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(emoji, 48, 52);
  const image = canvas.toDataURL("image/png");
  emojiImageCache.set(emoji, image);
  return image;
}

/** Utilise d'abord le véritable emoji de l'appareil. Le dessin vectoriel sert
 *  seulement de secours dans les tests ou si le navigateur ne sait pas le
 *  convertir en image. */
function drawLeaveEmoji(
  doc: jsPDF,
  leaveType: PdfLeaveType,
  centerX: number,
  centerY: number,
) {
  const emojiImage = leaveEmojiImage(leaveType);
  if (emojiImage) {
    try {
      doc.addImage(
        emojiImage,
        "PNG",
        centerX - 1.9,
        centerY - 1.9,
        3.8,
        3.8,
        `leave-emoji-${leaveType}`,
        "FAST",
      );
      return;
    } catch {
      // Le secours vectoriel ci-dessous garantit un PDF lisible même dans un
      // ancien navigateur qui ne sait pas intégrer le PNG du canvas.
    }
  }
  doc.setLineWidth(0.18);
  doc.setDrawColor(35, 35, 35);

  if (leaveType === "other") {
    // 📌 Punaise rouge
    doc.setFillColor(239, 83, 97);
    doc.ellipse(centerX, centerY - 0.85, 1.15, 0.52, "FD");
    doc.triangle(
      centerX - 0.72,
      centerY - 0.45,
      centerX + 0.72,
      centerY - 0.45,
      centerX + 0.22,
      centerY + 0.68,
      "FD",
    );
    doc.setDrawColor(90, 98, 109);
    doc.line(centerX + 0.18, centerY + 0.52, centerX - 0.25, centerY + 1.45);
    return;
  }

  if (leaveType === "strike") {
    // ✊ Poing levé doré, bordé de noir.
    doc.setFillColor(245, 190, 67);
    [-0.86, -0.3, 0.28, 0.82].forEach((offset, index) => {
      doc.roundedRect(
        centerX + offset - 0.28,
        centerY - 1.25 + (index === 0 ? 0.18 : 0),
        0.58,
        1.35,
        0.22,
        0.22,
        "FD",
      );
    });
    doc.roundedRect(centerX - 1.05, centerY - 0.12, 2.1, 1.28, 0.28, 0.28, "FD");
    doc.ellipse(centerX - 0.82, centerY + 0.18, 0.42, 0.65, "FD");
    return;
  }

  // Visages jaunes pour 🤒 et 👶.
  doc.setFillColor(255, 211, 74);
  doc.circle(centerX, centerY, 1.45, "FD");
  doc.setFillColor(45, 45, 45);
  doc.circle(centerX - 0.52, centerY - 0.38, 0.13, "F");
  doc.circle(centerX + 0.52, centerY - 0.38, 0.13, "F");

  if (leaveType === "sick") {
    // 🤒 Masque bleu clair.
    doc.setFillColor(187, 225, 239);
    doc.setDrawColor(64, 116, 139);
    doc.roundedRect(centerX - 0.95, centerY + 0.05, 1.9, 0.78, 0.18, 0.18, "FD");
    doc.line(centerX - 0.95, centerY + 0.22, centerX - 1.35, centerY - 0.02);
    doc.line(centerX + 0.95, centerY + 0.22, centerX + 1.35, centerY - 0.02);
    return;
  }

  // 👶 Petite mèche et tétine.
  doc.setDrawColor(133, 88, 29);
  doc.setLineWidth(0.28);
  doc.line(centerX - 0.42, centerY - 1.27, centerX - 0.05, centerY - 1.62);
  doc.line(centerX - 0.05, centerY - 1.62, centerX + 0.25, centerY - 1.28);
  doc.setFillColor(116, 188, 220);
  doc.setDrawColor(44, 104, 132);
  doc.circle(centerX, centerY + 0.52, 0.48, "FD");
  doc.setFillColor(255, 255, 255);
  doc.circle(centerX, centerY + 0.52, 0.18, "F");
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** « 02 mai 26 » plutôt que « 02/05/2026 » : le tableau des vacances
 *  scolaires se lit sans avoir à décoder trois groupes de chiffres. */
function drawCenteredText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.text(text, x + width / 2, y + height / 2, {
    align: "center",
    baseline: "middle",
  });
}

function drawGroupPage(
  doc: jsPDF,
  year: number,
  group: number,
  getDayInfo: PlanningPdfOptions["getDayInfo"],
  wasPompidouHolidayWorked: PlanningPdfOptions["wasPompidouHolidayWorked"],
  leaveTypes?: ReadonlyMap<string, PdfLeaveType>,
  halfMoments?: ReadonlyMap<string, PdfHalfMoment>,
  halfBalances?: ReadonlyMap<string, "rtt" | "fraction" | "exceptional" | "other">,
  schoolVacationDates?: ReadonlySet<string>,
  wishDates?: ReadonlySet<string>,
  schoolVacationsByZone?: PlanningPdfOptions["schoolVacationsByZone"],
  closedDates?: ReadonlySet<string>,
  exchangeMarkers?: ReadonlyMap<string, PdfExchangeMarker>,
  assets?: PlanningPdfAssets,
  showColorLegend = true,
  footerStyle: PlainFooterStyle = "band",
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  // La grille occupe toute la largeur ; le résumé, la légende et les
  // vacances se rangent dans un pied de page sous elle.
  const sidebarX = 7;
  const marginX = sidebarX;
  const rightMargin = 8;
  const tableY = 8;
  const tableWidth = pageWidth - marginX - rightMargin;
  const monthWidth = tableWidth / 12;
  const headerHeight = 9;
  const footerGap = 4;
  const bottomMargin = 6;
  const vacationRows = schoolVacationsByZone ? schoolVacationTableRows(schoolVacationsByZone).length : 0;
  // Sans congés ni vacances, le pied de page peut se faire plus discret.
  const plainFooter = !showColorLegend && !schoolVacationsByZone ? footerStyle : "summary";
  const footerHeight = vacationRows
    ? 6.8 + vacationRows * 5.3
    : plainFooter === "band" ? 11 : 24;
  // La grille prend toute la hauteur que le pied de page lui laisse.
  const dayHeight = (pageHeight - tableY - headerHeight - footerGap - footerHeight - bottomMargin) / 31;
  const tableHeight = headerHeight + 31 * dayHeight;
  const blackOutlineWidth = 0.35;
  const redLineWidth = 0.55;
  const monthBottoms: number[] = [];
  let workedHolidayCount = 0;
  let offeredHolidayCount = 0;

  doc.setLineJoin("miter");
  doc.setLineCap("butt");
  void schoolVacationDates;

  for (let month = 0; month < 12; month++) {
    const x = marginX + month * monthWidth;
    doc.setFillColor(...COLORS.month);
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.35);
    doc.rect(x, tableY, monthWidth, headerHeight, "FD");
    doc.setTextColor(...COLORS.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    drawCenteredText(doc, MONTHS[month], x, tableY, monthWidth, headerHeight);

    const monthLength = daysInMonth(year, month);
    const monthDays = Array.from({ length: monthLength }, (_, index) => {
      const day = index + 1;
      const date = new Date(year, month, day, 12, 0, 0, 0);
      const info = getDayInfo(date, group);
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const exchange = exchangeMarkers?.get(key);
      const isOff = exchange ? exchange.role === "given" : info.kind === "off";
      // Un férié échangé : celui qu'on cède n'est plus travaillé (case noire),
      // celui qu'on reprend l'est (case blanche, sans la couleur du férié).
      const isWorkedHoliday = Boolean(info.holiday) && (exchange ? exchange.role === "return" : info.kind === "work");
      const holidayColored = isWorkedHoliday && !exchange;
      const baseFill = isOff
        ? COLORS.black
        : holidayColored
          ? COLORS.holiday
          : info.kind === "training"
            ? COLORS.training
            : COLORS.white;
      const workAccidentFill = isOff
        ? COLORS.black
        : holidayColored
          ? COLORS.holiday
          : COLORS.workAccident;
      // Une absence enregistrée reste visible même si elle tombe sur un repos
      // du cycle ou un jour férié : le PDF « avec congés » doit refléter les
      // données réellement posées, sans en masquer selon la nature du jour.
      const leaveType = leaveTypes?.get(key);
      const isRecovery = leaveType === "recovery";
      const isFullLeave = Boolean(
        leaveType && leaveType !== "half" && leaveType !== "recovery",
      );
      const isWish = Boolean(wishDates?.has(key));
      // La clé représente la couleur réellement imprimée. Deux journées
      // consécutives de même couleur forment un seul bloc ; un changement de
      // couleur crée automatiquement une nouvelle bordure noire.
      const colorBlockKey = isWish
        ? "wish"
        : isRecovery
          ? "recovery"
          : isFullLeave
            ? leaveType === "strike"
              ? "strike"
              : leaveType === "other"
                ? "other"
                : leaveType === "work_accident"
                  ? "work_accident"
                  : "leave"
            : "";
      return {
        date,
        key,
        info,
        isOff,
        isWorkedHoliday,
        holidayColored,
        baseFill,
        workAccidentFill,
        exchange,
        leaveType,
        halfMoment: leaveType === "half" ? halfMoments?.get(key) : undefined,
        halfBalance: leaveType === "half" ? halfBalances?.get(key) : undefined,
        isRecovery,
        isFullLeave,
        isWish,
        colorBlockKey,
      };
    });
    for (let day = 1; day <= 31; day++) {
      const y = tableY + headerHeight + (day - 1) * dayHeight;
      if (day > monthLength) continue;

      const {
        date,
        key,
        info,
        isOff,
        isWorkedHoliday,
        holidayColored,
        baseFill,
        workAccidentFill,
        exchange,
        leaveType,
        halfMoment,
        halfBalance,
        isRecovery,
        isFullLeave,
        isWish,
        colorBlockKey,
      } = monthDays[day - 1];
      const isClosed = Boolean(closedDates?.has(key));
      const isOfferedHoliday =
        Boolean(info.holiday) &&
        info.kind !== "work" &&
        !exchange &&
        wasPompidouHolidayWorked(date, group);
      // Le congé souhaité prime sur la couleur du jour : c'est l'information
      // qu'on cherche en parcourant la colonne.
      const fill = isWish
        ? COLORS.wish
        : isRecovery
          ? COLORS.recovery
          : isFullLeave
            ? leaveType === "work_accident"
              ? workAccidentFill
              : leaveFill(leaveType)
            : leaveType === "half"
              ? COLORS.white
            : isOff
              ? COLORS.black
              : holidayColored
                ? COLORS.holiday
                : info.kind === "training"
                  ? COLORS.training
                  : COLORS.white;
      const darkCell = isBlackColor(fill);
      const textColor = darkCell ? COLORS.white : COLORS.black;
      const dayLabel = `${WEEKDAYS[date.getDay()]} ${day}${info.holiday ? "  Férié" : ""}`;
      if (isWorkedHoliday) workedHolidayCount++;
      if (isOfferedHoliday) offeredHolidayCount++;

      if (isClosed) {
        const previousClosed = Boolean(monthDays[day - 2] && closedDates?.has(monthDays[day - 2].key));
        if (!previousClosed) {
          let blockLength = 1;
          while (monthDays[day - 1 + blockLength] && closedDates?.has(monthDays[day - 1 + blockLength].key))
            blockLength++;
          const blockDays = monthDays.slice(day - 1, day - 1 + blockLength);
          paintColorRuns(doc, x, y, monthWidth, dayHeight, blockDays.map((item) => item.baseFill));
          drawClosedFrame(doc, x, y, monthWidth, blockLength * dayHeight, false);
        }
        const closedDayColor = isBlackColor(baseFill) ? COLORS.white : COLORS.black;
        doc.setTextColor(closedDayColor[0], closedDayColor[1], closedDayColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.9);
        doc.text(dayLabel, x + 1.6, y + dayHeight / 2, { baseline: "middle" });
        const closedTextColor: PdfColor = isBlackColor(baseFill) ? COLORS.white : [225, 28, 35];
        doc.setTextColor(closedTextColor[0], closedTextColor[1], closedTextColor[2]);
        doc.setFont("helvetica", "bold");
        let closedFontSize = 5.4;
        doc.setFontSize(closedFontSize);
        const closedRight = x + monthWidth - 1.2;
        const dayLabelRight = x + 1.6 + doc.getTextWidth(dayLabel) + 0.6;
        while (closedFontSize > 3.8 && closedRight - doc.getTextWidth("CLOSED") < dayLabelRight) {
          closedFontSize -= 0.1;
          doc.setFontSize(closedFontSize);
        }
        doc.setFont("helvetica", "bold");
        doc.setCharSpace(0.08);
        doc.text("CLOSED", closedRight, y + dayHeight / 2, { align: "right", baseline: "middle" });
        doc.setCharSpace(0);
        continue;
      }

      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(...COLORS.black);
      doc.setLineWidth(0.18);
      if (colorBlockKey === "work_accident") {
        // L'accident est peint en un seul rectangle continu. Cela évite les
        // coutures d'anticrénelage que produisaient plusieurs aplats accolés.
        if (monthDays[day - 2]?.colorBlockKey !== colorBlockKey) {
          let blockLength = 1;
          while (monthDays[day - 1 + blockLength]?.colorBlockKey === colorBlockKey)
            blockLength++;
          const blockDays = monthDays.slice(day - 1, day - 1 + blockLength);
          paintColorRuns(doc, x, y, monthWidth, dayHeight, blockDays.map((item) => item.workAccidentFill));
          doc.setDrawColor(...COLORS.black);
          doc.setLineWidth(0.35);
          doc.rect(x, y, monthWidth, blockLength * dayHeight, "S");
        }
      } else if (colorBlockKey) {
        // Un seul liseré noir entoure tout le bloc de couleur. Il n'y a donc
        // aucune coupe entre deux journées consécutives de même couleur.
        doc.rect(x, y, monthWidth, dayHeight, "F");
        doc.setLineWidth(0.28);
        doc.line(x, y, x, y + dayHeight);
        doc.line(x + monthWidth, y, x + monthWidth, y + dayHeight);
        if (monthDays[day - 2]?.colorBlockKey !== colorBlockKey)
          doc.line(x, y, x + monthWidth, y);
        if (monthDays[day]?.colorBlockKey !== colorBlockKey)
          doc.line(x, y + dayHeight, x + monthWidth, y + dayHeight);
      } else {
        doc.rect(x, y, monthWidth, dayHeight, "FD");
        if (leaveType === "half") {
          // La couleur du solde ne couvre que la moitié posée : à gauche le
          // matin, à droite l'après-midi.
          const [red, green, blue] =
            halfBalance === "rtt" ? COLORS.rtt : halfBalance === "fraction" ? COLORS.fraction : halfBalance === "other" ? leaveFill("other") : COLORS.leave;
          doc.setFillColor(red, green, blue);
          doc.rect(
            halfMoment === "afternoon" ? x + monthWidth / 2 : x,
            y,
            monthWidth / 2,
            dayHeight,
            "F",
          );
          doc.setDrawColor(...COLORS.black);
          doc.setLineWidth(0.18);
          doc.rect(x, y, monthWidth, dayHeight, "S");
          // Un trait au milieu ferme le bleu : sans lui, la couleur s'arrête
          // dans le vide et la moitié posée se devine au lieu de se lire.
          doc.line(
            x + monthWidth / 2,
            y,
            x + monthWidth / 2,
            y + dayHeight,
          );
        }
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.9);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(dayLabel, x + 1.6, y + dayHeight / 2, { baseline: "middle" });
      if (isOfferedHoliday) {
        const badgeRadius = 1.35;
        const badgeCenterX = x + monthWidth - (badgeRadius + 2.4);
        doc.setFillColor(...COLORS.money);
        doc.circle(badgeCenterX, y + dayHeight / 2, badgeRadius, "F");
        doc.setTextColor(...COLORS.black);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.4);
        doc.text("€", badgeCenterX, y + dayHeight / 2, {
          align: "center",
          baseline: "middle",
        });
      }
      if (leaveType) {
        // Les mentions sont décalées de 2 mm vers la gauche du trait
        // d'encadrement.
        const codeRight = x + monthWidth - 0.9 - 2;
        if (leaveType === "work_accident") {
          drawWorkAccidentMarker(doc, assets?.workAccident, codeRight - 1.6, y + dayHeight / 2);
          continue;
        }
        if (EMOJI_LEAVE_TYPES.has(leaveType)) {
          drawLeaveEmoji(doc, leaveType, codeRight - 1.25, y + dayHeight / 2);
          continue;
        }
        const code = leaveType === "half"
          ? halfBalance === "rtt" ? "½ RTT" : halfBalance === "fraction" ? "½ Frac." : halfBalance === "exceptional" ? "½ ASA" : halfBalance === "other" ? "½ Div." : "½ CA"
          : LEAVE_CODES[leaveType];
        doc.setTextColor(...COLORS.black);
        doc.setFont("helvetica", "bold");
        // Les libellés longs (« Congé enf. ») sont réduits juste ce qu'il faut
        // pour ne jamais chevaucher le jour inscrit à gauche de la case.
        doc.setFontSize(5.9);
        const dayLabelRight = x + 1.6 + doc.getTextWidth(dayLabel) + 0.6;
        let codeFontSize = 4.5;
        doc.setFontSize(codeFontSize);
        while (
          codeFontSize > 3 &&
          codeRight - doc.getTextWidth(code) < dayLabelRight
        ) {
          codeFontSize -= 0.1;
          doc.setFontSize(codeFontSize);
        }
        doc.text(code, codeRight, y + dayHeight / 2, {
          align: "right",
          baseline: "middle",
        });
      }
      if (exchange) {
        drawExchangeMarker(
          doc,
          // Un férié échangé : les flèches entourent un dollar.
          info.holiday ? assets?.holidayExchange ?? assets?.exchange : assets?.exchange,
          // Plus petite et calée contre le bord droit : la pastille laisse de
          // l'air au texte de la case (« Ve 25  Férié »).
          x + monthWidth - 3.9,
          y + dayHeight / 2,
          exchange.number,
          0.78,
          info.holiday && assets?.holidayExchange ? "holiday-exchange-marker" : "exchange-marker",
        );
      }
    }

    monthBottoms.push(tableY + headerHeight + monthLength * dayHeight);
  }

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(blackOutlineWidth);
  monthBottoms.forEach((bottom, month) => {
    const x = marginX + month * monthWidth;
    doc.line(x, bottom, x + monthWidth, bottom);
    if (month < 11) {
      doc.line(x + monthWidth, bottom, x + monthWidth, monthBottoms[month + 1]);
    }
  });

  for (let monthBoundary = 1; monthBoundary < 12; monthBoundary++) {
    if (monthBoundary === 4 || monthBoundary === 9) continue;
    const x = marginX + monthBoundary * monthWidth;
    doc.line(
      x,
      tableY,
      x,
      Math.max(monthBottoms[monthBoundary - 1], monthBottoms[monthBoundary]),
    );
  }

  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(redLineWidth);
  doc.line(marginX, tableY, marginX + tableWidth, tableY);
  [0, 4, 9, 12].forEach((monthBoundary) => {
    const x = marginX + monthBoundary * monthWidth;
    const bottom =
      monthBoundary === 0
        ? monthBottoms[0]
        : monthBoundary === 12
          ? monthBottoms[11]
          : Math.max(
              monthBottoms[monthBoundary - 1],
              monthBottoms[monthBoundary],
            );
    doc.line(x, tableY, x, bottom);
  });

  // Pied de page en trois cases sous la grille : le résumé du planning, la
  // légende des couleurs avec ses logos, puis les vacances scolaires. La
  // grille garde ainsi toute la largeur de la feuille.
  const footerY = tableY + tableHeight + footerGap;
  const footerRight = pageWidth - rightMargin;
  const panelBorderWidth = 0.42;
  // Avec les vacances, le résumé se range en carré 2 × 2 ; sans elles, sur
  // une ligne de quatre cases, plus lisible dans un pied de page bas.
  const statsColumns = schoolVacationsByZone ? 2 : 4;
  const statsWidth = schoolVacationsByZone ? 46 : 96;
  const legendColumns = schoolVacationsByZone ? 3 : 5;
  const legendWidth = showColorLegend
    ? schoolVacationsByZone ? 96 : footerRight - sidebarX - statsWidth - 4
    : 0;

  if (plainFooter !== "summary") {
    drawPlainFooter(doc, {
      x: sidebarX,
      y: footerY,
      width: footerRight - sidebarX,
      height: footerHeight,
      year,
      group,
      workedHolidayCount,
      offeredHolidayCount,
    });
  }

  // Résumé : quatre cases sous un bandeau « PLANNING ».
  if (plainFooter === "summary") {
    const x = sidebarX;
    const bandHeight = 6;
    const cellWidth = statsWidth / statsColumns;
    const cellHeight = (footerHeight - bandHeight) / (4 / statsColumns);
    const facts = [
      ["Année", String(year), COLORS.yearValue],
      ["Groupe", String(group), COLORS.groupValue],
      ["Fériés travaillés", String(workedHolidayCount), COLORS.holidaysValue],
      ["Fériés compensés", String(offeredHolidayCount), [255, 239, 216] as const],
    ] as const;
    doc.setFillColor(248, 250, 253);
    doc.roundedRect(x, footerY, statsWidth, footerHeight, 1.6, 1.6, "F");
    doc.setFillColor(...COLORS.slate);
    doc.roundedRect(x, footerY, statsWidth, bandHeight, 1.6, 1.6, "F");
    doc.rect(x, footerY + bandHeight - 1.6, statsWidth, 1.6, "F");
    doc.setTextColor(...COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    drawCenteredText(doc, "PLANNING", x, footerY, statsWidth, bandHeight);
    facts.forEach(([label, value, color], index) => {
      const cellX = x + (index % statsColumns) * cellWidth;
      const cellY = footerY + bandHeight + Math.floor(index / statsColumns) * cellHeight;
      doc.setFillColor(color[0], color[1], color[2]);
      doc.setDrawColor(181, 193, 208);
      doc.setLineWidth(0.2);
      doc.rect(cellX, cellY, cellWidth, cellHeight, "FD");
      doc.setTextColor(...COLORS.black);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.6);
      doc.text(label, cellX + cellWidth / 2, cellY + cellHeight * 0.28, { align: "center", baseline: "middle" });
      const valueY = cellY + cellHeight * 0.66;
      if (label === "Fériés compensés") {
        const badgeX = cellX + cellWidth / 2 - 2.2;
        doc.setFillColor(...COLORS.money);
        doc.circle(badgeX, valueY, 1.7, "F");
        doc.setFontSize(5.9);
        doc.text("€", badgeX, valueY, { align: "center", baseline: "middle" });
        doc.setFontSize(9.4);
        doc.text(value, badgeX + 3.3, valueY, { baseline: "middle" });
      } else {
        doc.setFontSize(9.4);
        doc.text(value, cellX + cellWidth / 2, valueY, { align: "center", baseline: "middle" });
      }
    });
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(panelBorderWidth);
    doc.roundedRect(x, footerY, statsWidth, footerHeight, 1.6, 1.6, "S");
    doc.line(x, footerY + bandHeight, x + statsWidth, footerY + bandHeight);
  }

  if (showColorLegend) {
    const colorLegendItems: Array<{
      label: string;
      color: readonly [number, number, number];
      moneyBadge?: boolean;
      emojiType?: PdfLeaveType;
      assetType?: keyof PlanningPdfAssets;
      closedBadge?: boolean;
    }> = [
      { label: "Travail", color: COLORS.white },
      { label: "Repos", color: COLORS.black },
      { label: "Formation", color: COLORS.training },
      { label: "Férié travaillé", color: COLORS.holiday },
      { label: "Congé validé", color: COLORS.leave },
      { label: "Congé souhaité", color: COLORS.wish },
      { label: "Récupération", color: COLORS.recovery },
      { label: "Échange n°", color: COLORS.white, assetType: "exchange" },
      { label: "Maladie", color: COLORS.leave, emojiType: "sick" },
      { label: "Garde d'enfant", color: COLORS.leave, emojiType: "childcare" },
      { label: "Grève", color: leaveFill("strike"), emojiType: "strike" },
      { label: "Divers", color: leaveFill("other"), emojiType: "other" },
      { label: "Accident de travail", color: COLORS.workAccident, assetType: "workAccident" },
      { label: "Fermeture exceptionnelle", color: COLORS.white, closedBadge: true },
      { label: "Férié compensé", color: COLORS.money, moneyBadge: true },
    ];
    const x = sidebarX + statsWidth + 4;
    const bandHeight = 6;
    const rows = Math.ceil(colorLegendItems.length / legendColumns);
    const columnWidth = legendWidth / legendColumns;
    const rowHeight = (footerHeight - bandHeight - 1.5) / rows;

    doc.setFillColor(248, 250, 253);
    doc.roundedRect(x, footerY, legendWidth, footerHeight, 1.5, 1.5, "F");
    doc.setFillColor(224, 231, 240);
    doc.roundedRect(x, footerY, legendWidth, bandHeight, 1.5, 1.5, "F");
    doc.rect(x, footerY + bandHeight - 1.5, legendWidth, 1.5, "F");
    doc.setTextColor(...COLORS.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    drawCenteredText(doc, "LÉGENDE", x, footerY, legendWidth, bandHeight);

    colorLegendItems.forEach((item, index) => {
      // Colonne par colonne, de haut en bas.
      const column = Math.floor(index / rows);
      const row = index % rows;
      const symbolX = x + column * columnWidth + 6;
      const centerY = footerY + bandHeight + 0.75 + (row + 0.5) * rowHeight;
      if (item.moneyBadge) {
        doc.setFillColor(...COLORS.money);
        doc.circle(symbolX, centerY, 1.75, "F");
        doc.setTextColor(...COLORS.black);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.text("€", symbolX, centerY, { align: "center", baseline: "middle" });
      } else {
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.setDrawColor(...COLORS.black);
        doc.setLineWidth(0.2);
        const symbolWidth = item.closedBadge ? 7.6 : 7;
        const symbolHeight = item.closedBadge ? 3.6 : 4.2;
        // L'étiquette d'échange a son propre contour : pas de case derrière.
        if (item.assetType !== "exchange")
          doc.rect(symbolX - symbolWidth / 2, centerY - symbolHeight / 2, symbolWidth, symbolHeight, "FD");
        if (item.emojiType) drawLeaveEmoji(doc, item.emojiType, symbolX, centerY);
        else if (item.assetType === "workAccident") drawWorkAccidentMarker(doc, assets?.workAccident, symbolX, centerY);
        else if (item.assetType === "exchange") drawExchangeMarker(doc, assets?.exchange, symbolX, centerY, 1, 0.85);
        else if (item.closedBadge) {
          doc.setTextColor(225, 28, 35);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(3.6);
          doc.text("CLOSED", symbolX, centerY, { align: "center", baseline: "middle" });
        }
      }
      doc.setTextColor(...COLORS.black);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
      // Sur trois colonnes, l'intitulé le plus long se raccourcit pour tenir.
      const label = legendColumns === 3 && item.closedBadge ? "Fermeture except." : item.label;
      doc.text(label, symbolX + 5.2, centerY, { baseline: "middle" });
    });
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(panelBorderWidth);
    doc.roundedRect(x, footerY, legendWidth, footerHeight, 1.5, 1.5, "S");
    doc.line(x, footerY + bandHeight, x + legendWidth, footerY + bandHeight);
  }

  if (schoolVacationsByZone) {
    const x = sidebarX + statsWidth + 4 + (showColorLegend ? legendWidth + 4 : 0);
    drawSchoolVacationTable(doc, schoolVacationsByZone, {
      x,
      y: footerY,
      width: footerRight - x,
      height: footerHeight,
    });
  }

}

/** Pied de page du planning d'un groupe, sans congés ni vacances : sous un
 *  filet noir, « Planning 2026 · Groupe 2 » à gauche et les fériés à droite,
 *  comme la légende d'un tableau. Pas de cadre ni de légende des couleurs. */
function drawPlainFooter(
  doc: jsPDF,
  box: { x: number; y: number; width: number; height: number; year: number; group: number; workedHolidayCount: number; offeredHolidayCount: number },
) {
  const { x, y, width, height } = box;
  const centerY = y + height / 2;
  // Légende de tableau : un filet noir, l'identité à gauche, les fériés à
  // droite, sans cadre.
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.line(x, y + 0.6, x + width, y + 0.6);
  doc.setTextColor(...COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const title = `Planning ${box.year}`;
  doc.text(title, x, centerY + 0.8, { baseline: "middle" });
  const titleWidth = doc.getTextWidth(title);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`·  Groupe ${box.group}`, x + titleWidth + 3, centerY + 0.8, { baseline: "middle" });
  const right = x + width;
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.black);
  const compText = `${box.offeredHolidayCount} férié${box.offeredHolidayCount > 1 ? "s" : ""} compensé${box.offeredHolidayCount > 1 ? "s" : ""}`;
  const workText = `${box.workedHolidayCount} férié${box.workedHolidayCount > 1 ? "s" : ""} travaillé${box.workedHolidayCount > 1 ? "s" : ""}`;
  doc.setFont("helvetica", "bold");
  const compWidth = doc.getTextWidth(compText);
  doc.text(compText, right, centerY + 0.8, { align: "right", baseline: "middle" });
  drawEuroBadge(doc, right - compWidth - 3.6, centerY + 0.8, 1.9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const workRight = right - compWidth - 12;
  const workWidth = doc.getTextWidth(workText);
  doc.text(workText, workRight, centerY + 0.8, { align: "right", baseline: "middle" });
  doc.setFillColor(...COLORS.holiday);
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.2);
  doc.rect(workRight - workWidth - 9.5, centerY + 0.8 - 2.2, 7, 4.4, "FD");
}

/** La pastille « € » des fériés compensés, comme dans le calendrier. */
function drawEuroBadge(doc: jsPDF, cx: number, cy: number, r = 2) {
  doc.setFillColor(...COLORS.money);
  doc.circle(cx, cy, r, "F");
  doc.setTextColor(...COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(r * 3.3);
  doc.text("€", cx, cy, { align: "center", baseline: "middle" });
}


const SHORT_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 1er », « 7 », puis le mois abrégé ; l'année seulement si la période
 *  passe d'une année à l'autre. */
function shortVacationRange(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const day = (value: number) => (value === 1 ? "1er" : String(value));
  if (fromYear !== toYear) {
    return `${day(fromDay)} ${SHORT_MONTHS[fromMonth - 1]} ${fromYear} – ${day(toDay)} ${SHORT_MONTHS[toMonth - 1]} ${toYear}`;
  }
  if (fromMonth === toMonth) return `${day(fromDay)} – ${day(toDay)} ${SHORT_MONTHS[toMonth - 1]}`;
  return `${day(fromDay)} ${SHORT_MONTHS[fromMonth - 1]} – ${day(toDay)} ${SHORT_MONTHS[toMonth - 1]}`;
}

function vacationShortName(name: string) {
  const short = name
    .replace("Vacances de la ", "")
    .replace("Vacances de ", "")
    .replace("Vacances d’", "")
    .replace("Vacances d'", "")
    .replace("Vacances ", "")
    .trim();
  return short.charAt(0).toLocaleUpperCase("fr-FR") + short.slice(1);
}

type ZoneVacation = { name: string; from: string; to: string };

/** Lignes du tableau des vacances : même période (nom et rang) dans chaque
 *  zone, dans l'ordre de l'année. */
function schoolVacationTableRows(byZone: Record<"A" | "B" | "C", ZoneVacation[]>) {
  const zones = ["A", "B", "C"] as const;
  const rows = new Map<string, { name: string; first: string; cells: Partial<Record<"A" | "B" | "C", ZoneVacation>> }>();
  zones.forEach((zone) => {
    const seen = new Map<string, number>();
    byZone[zone].forEach((vacation) => {
      const name = vacationShortName(vacation.name);
      const rank = (seen.get(name) ?? 0) + 1;
      seen.set(name, rank);
      const key = `${name}#${rank}`;
      const row = rows.get(key) ?? { name, first: vacation.from, cells: {} };
      row.cells[zone] = vacation;
      if (vacation.from < row.first) row.first = vacation.from;
      rows.set(key, row);
    });
  });
  return [...rows.values()].sort((left, right) => left.first.localeCompare(right.first));
}

/** Vacances scolaires des trois zones : une ligne par période, une colonne
 *  par zone. Les périodes communes aux trois zones (Noël, été, Toussaint)
 *  tiennent sur une seule ligne, marquée des trois pastilles de zone. */
function drawSchoolVacationTable(
  doc: jsPDF,
  byZone: Record<"A" | "B" | "C", ZoneVacation[]>,
  box: { x: number; y: number; width: number; height?: number },
) {
  const zones = ["A", "B", "C"] as const;
  const zoneInk = { A: [52, 104, 166], B: [46, 122, 92], C: [178, 104, 44] } as const;
  // Fonds des dates propres à chaque zone : assez soutenus pour se repérer
  // d'un coup d'œil, assez clairs pour garder le texte lisible.
  const zoneTint = { A: [212, 229, 247], B: [210, 237, 223], C: [249, 223, 198] } as const;
  const paper = [251, 248, 244] as const;
  const line = [221, 212, 200] as const;
  const ink = [44, 38, 33] as const;
  const muted = [120, 108, 94] as const;

  const ordered = schoolVacationTableRows(byZone);
  if (!ordered.length) return;

  const { x, y, width } = box;
  const nameWidth = width * 0.19;
  const zoneWidth = (width - nameWidth) / zones.length;
  const headerHeight = 6.8;
  const rowHeight = box.height ? (box.height - headerHeight) / ordered.length : 5.3;
  const height = headerHeight + ordered.length * rowHeight;
  const radius = 2;

  // Fond, colonne des périodes teintée de violet (la couleur des vacances
  // dans l'application), puis chaque zone dans sa couleur.
  const violet = [116, 70, 214] as const;
  const violetTint = [240, 235, 251] as const;
  doc.setFillColor(...paper);
  doc.roundedRect(x, y, width, height, radius, radius, "F");
  doc.setFillColor(...violetTint);
  doc.roundedRect(x, y, nameWidth, height, radius, radius, "F");
  doc.rect(x + nameWidth - radius, y, radius, height, "F");
  doc.setFillColor(...violet);
  doc.roundedRect(x, y, nameWidth, headerHeight, radius, radius, "F");
  doc.rect(x + nameWidth - radius, y, radius, headerHeight, "F");
  doc.rect(x, y + headerHeight - radius, nameWidth, radius, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  doc.setTextColor(255, 255, 255);
  doc.text("Vacances scolaires", x + 2.6, y + headerHeight / 2, { baseline: "middle" });
  zones.forEach((zone, index) => {
    const zoneX = x + nameWidth + index * zoneWidth;
    const color = zoneInk[zone];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(zoneX, y, zoneWidth, headerHeight, "F");
    if (index === zones.length - 1) {
      // Coin arrondi en haut à droite, comme le cadre.
      doc.setFillColor(...paper);
      doc.rect(zoneX + zoneWidth - radius, y, radius, radius, "F");
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(zoneX, y, zoneWidth, headerHeight, radius, radius, "F");
      doc.rect(zoneX, y + radius, zoneWidth, headerHeight - radius, "F");
      doc.rect(zoneX, y, zoneWidth - radius, headerHeight, "F");
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.9);
    doc.text(`Zone ${zone}`, zoneX + zoneWidth / 2, y + headerHeight / 2, { align: "center", baseline: "middle" });
  });

  // Chaque date tient dans une pastille de même hauteur, alignée sur la
  // grille des zones : une large pour une période commune, une par zone sinon.
  const pillInsetX = 1.4;
  const pillInsetY = Math.min(1, rowHeight * 0.16);
  const pillHeight = rowHeight - 2 * pillInsetY;
  ordered.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    const middle = rowY + rowHeight / 2;
    const cells = zones.map((zone) => row.cells[zone]);
    const shared = cells.every((cell) => cell && cell.from === cells[0]!.from && cell.to === cells[0]!.to);

    if (rowIndex > 0) {
      doc.setLineWidth(0.25);
      doc.setDrawColor(214, 203, 240);
      doc.line(x + 1.5, rowY, x + nameWidth, rowY);
      doc.setDrawColor(...line);
      doc.line(x + nameWidth, rowY, x + width - 1.5, rowY);
    }
    // Nom de la période, sur le fond violet clair.
    doc.setTextColor(68, 42, 130);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(row.name, x + 2.6, middle, { baseline: "middle" });

    const datesX = x + nameWidth;
    if (shared) {
      // Une pastille sur les trois zones, marquée à gauche de leurs trois
      // couleurs ; la plage au centre, « toutes zones » à droite.
      const pillX = datesX + pillInsetX;
      const pillW = width - nameWidth - 2 * pillInsetX;
      const pillY = rowY + pillInsetY;
      doc.setFillColor(243, 238, 231);
      doc.roundedRect(pillX, pillY, pillW, pillHeight, 1.2, 1.2, "F");
      zones.forEach((zone, index) => {
        const color = zoneInk[zone];
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(pillX + 1.6 + index * 1.5, pillY + pillHeight * 0.22, 1.1, pillHeight * 0.56, "F");
      });
      doc.setTextColor(...ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      doc.text(shortVacationRange(cells[0]!.from, cells[0]!.to), pillX + pillW / 2, middle, { align: "center", baseline: "middle" });
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(4.8);
      doc.text("toutes zones", pillX + pillW - 2, middle, { align: "right", baseline: "middle" });
      return;
    }
    zones.forEach((zone, index) => {
      const cell = row.cells[zone];
      const cellX = datesX + index * zoneWidth;
      const tint = zoneTint[zone];
      doc.setFillColor(tint[0], tint[1], tint[2]);
      doc.roundedRect(cellX + pillInsetX, rowY + pillInsetY, zoneWidth - 2 * pillInsetX, pillHeight, 1.2, 1.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      const color = zoneInk[zone];
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(cell ? shortVacationRange(cell.from, cell.to) : "—", cellX + zoneWidth / 2, middle, { align: "center", baseline: "middle" });
    });
  });

  // Cadre fin, à l'encre de la grille.
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, height, radius, radius, "S");
}

export function createAnnualPlanningPdf({
  year,
  groups,
  getDayInfo,
  wasPompidouHolidayWorked,
  leaveTypes,
  halfMoments,
  halfBalances,
  schoolVacationDates,
  wishDates,
  schoolVacationsByZone,
  closedDates,
  exchangeMarkers,
  assets,
  showColorLegend = true,
  footerStyle = "band",
  filenameLabel,
}: PlanningPdfOptions) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  groups.forEach((group, index) => {
    if (index > 0) doc.addPage("a4", "landscape");
    drawGroupPage(
      doc,
      year,
      group,
      getDayInfo,
      wasPompidouHolidayWorked,
      leaveTypes,
      halfMoments,
      halfBalances,
      schoolVacationDates,
      wishDates,
      schoolVacationsByZone,
      closedDates,
      exchangeMarkers,
      assets,
      showColorLegend,
      footerStyle,
    );
  });

  const groupLabel =
    filenameLabel ||
    (groups.length === 1 ? `groupe-${groups[0]}` : "3-groupes");
  return {
    blob: doc.output("blob"),
    filename: `planning-${year}-${groupLabel}.pdf`,
  };
}

export type WorkedHolidaySchedule = Array<{
  year: number;
  entries: Array<{
    key: string;
    name: string;
    groups: number[];
  }>;
}>;

/** Construit le tableau d'échange sans reprendre les fériés compensés : une
 * date n'est conservée que si `getDayInfo` la classe réellement en travail. */
export function buildWorkedHolidaySchedule(
  firstYear: number,
  lastYear: number,
  getInfo: PlanningPdfOptions["getDayInfo"],
): WorkedHolidaySchedule {
  return Array.from({ length: lastYear - firstYear + 1 }, (_, yearOffset) => {
    const year = firstYear + yearOffset;
    const entries: WorkedHolidaySchedule[number]["entries"] = [];
    for (
      let date = new Date(year, 0, 1);
      date.getFullYear() === year;
      date = new Date(year, date.getMonth(), date.getDate() + 1)
    ) {
      const infos = [1, 2, 3].map((group) => ({ group, info: getInfo(date, group) }));
      const name = infos.find(({ info }) => info.holiday)?.info.holiday || "";
      if (!name) continue;
      const groups = infos
        .filter(({ info }) => info.kind === "work")
        .map(({ group }) => group);
      if (!groups.length) continue;
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      entries.push({ key: `${year}-${month}-${day}`, name, groups });
    }
    return { year, entries };
  });
}

/** Tableau paysage d'une page, conçu comme aide visuelle aux échanges de
 * fériés entre les trois groupes. */
export function createWorkedHolidaysPdf({
  firstYear = workedHolidaysYearRange().firstYear,
  lastYear = workedHolidaysYearRange().lastYear,
  getDayInfo,
}: {
  firstYear?: number;
  lastYear?: number;
  getDayInfo: PlanningPdfOptions["getDayInfo"];
}) {
  const schedule = buildWorkedHolidaySchedule(firstYear, lastYear, getDayInfo);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const gap = 5;
  const top = 35;
  const columns = 3;
  const panelWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
  const panelHeight = (pageHeight - top - margin - gap) / 2;
  const accents = [
    [46, 105, 176],
    [37, 137, 103],
    [196, 116, 47],
    [104, 79, 172],
    [174, 71, 85],
  ] as const;
  const groupColors = {
    1: [48, 105, 180] as const,
    2: [41, 139, 105] as const,
    3: [202, 119, 43] as const,
  };

  doc.setFillColor(240, 246, 252);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setTextColor(24, 47, 76);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Jours fériés travaillés", margin, 15);
  doc.setFontSize(10);
  doc.setTextColor(47, 94, 151);
  doc.text("Tableau pour faciliter les échanges", margin, 22);
  const weekdayFormatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  schedule.forEach(({ year, entries }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (panelWidth + gap);
    const y = top + row * (panelHeight + gap);
    const accent = accents[index % accents.length];
    const headingHeight = 11;
    const columnHeight = 6;
    const rowHeight = Math.min(6.1, (panelHeight - headingHeight - columnHeight - 4) / Math.max(entries.length, 1));

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(150, 166, 187);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, panelWidth, panelHeight, 2.2, 2.2, "FD");
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.roundedRect(x, y, panelWidth, headingHeight, 2.2, 2.2, "F");
    doc.rect(x, y + headingHeight - 2.2, panelWidth, 2.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(String(year), x + 5, y + 7.1);
    doc.setFontSize(6.2);
    doc.text(`${entries.length} férié${entries.length > 1 ? "s" : ""} travaillé${entries.length > 1 ? "s" : ""}`, x + panelWidth - 5, y + 7, { align: "right" });

    const tableY = y + headingHeight;
    doc.setFillColor(235, 241, 248);
    doc.rect(x, tableY, panelWidth, columnHeight, "F");
    doc.setTextColor(66, 83, 104);
    doc.setFontSize(6);
    doc.text("DATE", x + 3, tableY + 3.9);
    doc.text("JOUR FÉRIÉ", x + 25, tableY + 3.9);
    doc.text("PRÉSENTS", x + panelWidth - 22, tableY + 3.9);

    entries.forEach((entry, entryIndex) => {
      const entryY = tableY + columnHeight + entryIndex * rowHeight;
      const middleY = entryY + rowHeight / 2;
      if (entryIndex % 2 === 0) {
        doc.setFillColor(248, 250, 253);
        doc.rect(x + 0.4, entryY, panelWidth - 0.8, rowHeight, "F");
      }
      if (entryIndex > 0) {
        doc.setDrawColor(222, 228, 236);
        doc.setLineWidth(0.18);
        doc.line(x + 2, entryY, x + panelWidth - 2, entryY);
      }
      const [yearPart, monthPart, dayPart] = entry.key.split("-").map(Number);
      const date = new Date(yearPart, monthPart - 1, dayPart);
      const dateLabel = weekdayFormatter.format(date).replace(",", "");
      doc.setTextColor(35, 53, 75);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.text(dateLabel, x + 3, middleY, { baseline: "middle" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      const holidayLabel = entry.name.length > 24 ? `${entry.name.slice(0, 23)}…` : entry.name;
      doc.text(holidayLabel, x + 25, middleY, { baseline: "middle" });

      const badgeWidth = 7.2;
      const badgeGap = 1.2;
      const badgesWidth = entry.groups.length * badgeWidth + (entry.groups.length - 1) * badgeGap;
      let badgeX = x + panelWidth - 3 - badgesWidth;
      entry.groups.forEach((group) => {
        const color = groupColors[group as keyof typeof groupColors];
        doc.setFillColor(color[0], color[1], color[2]);
        doc.roundedRect(badgeX, middleY - 2.05, badgeWidth, 4.1, 1.2, 1.2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.4);
        doc.text(`G${group}`, badgeX + badgeWidth / 2, middleY, { align: "center", baseline: "middle" });
        badgeX += badgeWidth + badgeGap;
      });
    });
  });

  return {
    blob: doc.output("blob"),
    filename: `feries-travailles-${firstYear}-${lastYear}.pdf`,
    schedule,
  };
}
