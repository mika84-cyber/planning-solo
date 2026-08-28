import { jsPDF } from "jspdf";

type PdfDayInfo = {
  kind: "work" | "off" | "training";
  holiday: string;
};
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
  | "exceptional";
/** Moitié posée sur une demi-journée. Absent pour les demi-journées venues du
 *  formulaire, qui n'en portent pas : la case est alors coloriée à gauche. */
type PdfHalfMoment = "morning" | "afternoon";
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
};

type PlanningPdfOptions = {
  year: number;
  groups: number[];
  getDayInfo: (date: Date, group: number) => PdfDayInfo;
  wasPompidouHolidayWorked: (date: Date, group: number) => boolean;
  leaveTypes?: ReadonlyMap<string, PdfLeaveType>;
  /** Moitié posée, jour par jour, pour les seules demi-journées. */
  halfMoments?: ReadonlyMap<string, PdfHalfMoment>;
  leaveSummary?: { used: number; remaining: number };
  schoolVacationDates?: ReadonlySet<string>;
  /** Congés souhaités, pas encore validés : leur case est verte. */
  wishDates?: ReadonlySet<string>;
  /** Vacances scolaires de l'année, regroupées dans les trois zones. */
  schoolVacationsByZone?: Record<
    "A" | "B" | "C",
    Array<{ name: string; from: string; to: string }>
  >;
  filenameLabel?: string;
};

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
    [-0.86, -0.3, 0.28, 0.82].forEach((offset, index) =>
      doc.roundedRect(
        centerX + offset - 0.28,
        centerY - 1.25 + (index === 0 ? 0.18 : 0),
        0.58,
        1.35,
        0.22,
        0.22,
        "FD",
      ),
    );
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
function frenchDate(key: string) {
  const [year, month, day] = key.split("-");
  const monthName = MONTHS[Number(month) - 1].toLowerCase();
  return `${day} ${monthName} ${year.slice(2)}`;
}

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
  schoolVacationDates?: ReadonlySet<string>,
  wishDates?: ReadonlySet<string>,
  schoolVacationsByZone?: PlanningPdfOptions["schoolVacationsByZone"],
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const sidebarX = 7;
  const sidebarWidth = schoolVacationsByZone ? 28 : 34;
  const marginX = sidebarX + sidebarWidth + 4;
  const rightMargin = 8;
  const tableY = 8;
  const tableWidth = pageWidth - marginX - rightMargin;
  const monthWidth = tableWidth / 12;
  const headerHeight = 9;
  // Sans le tableau des vacances, la grille utilise la hauteur disponible au
  // lieu de laisser une grande bande blanche au bas de la feuille.
  const dayHeight = schoolVacationsByZone ? 4.75 : 5.9;
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
      const isOff = info.kind === "off";
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
                : "leave"
            : "";
      return {
        date,
        info,
        isOff,
        leaveType,
        halfMoment: leaveType === "half" ? halfMoments?.get(key) : undefined,
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
        info,
        isOff,
        leaveType,
        halfMoment,
        isRecovery,
        isFullLeave,
        isWish,
        colorBlockKey,
      } = monthDays[day - 1];
      const isWorkedHoliday = Boolean(info.holiday) && info.kind === "work";
      const isOfferedHoliday =
        Boolean(info.holiday) &&
        info.kind !== "work" &&
        wasPompidouHolidayWorked(date, group);
      // Le congé souhaité prime sur la couleur du jour : c'est l'information
      // qu'on cherche en parcourant la colonne.
      const fill = isWish
        ? COLORS.wish
        : isRecovery
          ? COLORS.recovery
          : isFullLeave
            ? leaveFill(leaveType)
            : leaveType === "half"
              ? COLORS.white
            : isOff
              ? COLORS.black
              : isWorkedHoliday
                ? COLORS.holiday
                : info.kind === "training"
                  ? COLORS.training
                  : COLORS.white;
      const darkCell = isOff && !isWish && !leaveType;
      const textColor = darkCell ? COLORS.white : COLORS.black;
      if (isWorkedHoliday) workedHolidayCount++;
      if (isOfferedHoliday) offeredHolidayCount++;

      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(...COLORS.black);
      doc.setLineWidth(0.18);
      if (colorBlockKey) {
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
          // Le bleu des congés ne couvre que la moitié posée : à gauche le
          // matin, à droite l'après-midi.
          doc.setFillColor(...COLORS.leave);
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
      const dayLabel = `${WEEKDAYS[date.getDay()]} ${day}${info.holiday ? "  Férié" : ""}`;
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
        if (EMOJI_LEAVE_TYPES.has(leaveType)) {
          drawLeaveEmoji(doc, leaveType, codeRight - 1.25, y + dayHeight / 2);
          continue;
        }
        const code = leaveType === "half" ? "½ CA" : LEAVE_CODES[leaveType];
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

  // Colonne d'identification, puis légende des couleurs dans son prolongement.
  const sidebarHeight = 9 + 4 * 14;
  const panelBorderWidth = 0.42;
  doc.setFillColor(248, 250, 253);
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(panelBorderWidth);
  doc.roundedRect(sidebarX, tableY, sidebarWidth, sidebarHeight, 1.6, 1.6, "FD");
  doc.setFillColor(...COLORS.slate);
  doc.roundedRect(sidebarX, tableY, sidebarWidth, 9, 1.6, 1.6, "F");
  doc.rect(sidebarX, tableY + 7.4, sidebarWidth, 1.6, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.8);
  drawCenteredText(doc, "PLANNING", sidebarX, tableY, sidebarWidth, 9);

  const sidebarFacts = [
    ["Année", String(year), COLORS.yearValue],
    ["Groupe", String(group), COLORS.groupValue],
    ["Fériés travaillés", String(workedHolidayCount), COLORS.holidaysValue],
    ["Fériés compensés", String(offeredHolidayCount), [255, 239, 216] as const],
  ] as const;
  let sidebarY = tableY + 9;
  for (const [label, value, color] of sidebarFacts) {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setDrawColor(181, 193, 208);
    doc.setLineWidth(0.2);
    doc.rect(sidebarX, sidebarY, sidebarWidth, 14, "FD");
    doc.setTextColor(...COLORS.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(schoolVacationsByZone ? 4.8 : 5.5);
    doc.text(label, sidebarX + sidebarWidth / 2, sidebarY + 4.2, {
      align: "center",
      baseline: "middle",
    });
    if (label === "Fériés compensés") {
      const badgeCenterX = sidebarX + sidebarWidth / 2 - 2.2;
      const badgeCenterY = sidebarY + 9.7;
      doc.setFillColor(...COLORS.money);
      doc.circle(
        badgeCenterX,
        badgeCenterY,
        schoolVacationsByZone ? 1.7 : 1.85,
        "F",
      );
      doc.setTextColor(...COLORS.black);
      doc.setFontSize(schoolVacationsByZone ? 5.9 : 6.3);
      doc.text("€", badgeCenterX, badgeCenterY, {
        align: "center",
        baseline: "middle",
      });
      doc.setFontSize(schoolVacationsByZone ? 8.8 : 10.2);
      doc.text(value, badgeCenterX + 3.4, badgeCenterY, {
        baseline: "middle",
      });
    } else {
      doc.setFontSize(schoolVacationsByZone ? 8.8 : 10.2);
      doc.text(value, sidebarX + sidebarWidth / 2, sidebarY + 9.7, {
        align: "center",
        baseline: "middle",
      });
    }
    sidebarY += 14;
  }
  // Le bloc d'identification doit rester un repère plus affirmé que la
  // légende des couleurs. Son contour est redessiné après les aplats afin que
  // ceux-ci ne viennent pas l'atténuer.
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(panelBorderWidth);
  doc.roundedRect(sidebarX, tableY, sidebarWidth, sidebarHeight, 1.6, 1.6, "S");
  doc.line(sidebarX, tableY + 9, sidebarX + sidebarWidth, tableY + 9);

  const colorLegendItems: Array<{
    label: string;
    color: readonly [number, number, number];
    moneyBadge?: boolean;
    emojiType?: PdfLeaveType;
  }> = [
    { label: "Travail", color: COLORS.white },
    { label: "Repos", color: COLORS.black },
    { label: "Formation", color: COLORS.training },
    { label: "Férié travaillé", color: COLORS.holiday },
    { label: "Férié compensé", color: COLORS.money, moneyBadge: true },
    { label: "Congé validé", color: COLORS.leave },
    { label: "Maladie", color: COLORS.leave, emojiType: "sick" },
    {
      label: "Garde d'enfant",
      color: COLORS.leave,
      emojiType: "childcare",
    },
    { label: "Grève", color: leaveFill("strike"), emojiType: "strike" },
    { label: "Divers", color: leaveFill("other"), emojiType: "other" },
    { label: "Récupération", color: COLORS.recovery },
    { label: "Congé souhaité", color: COLORS.wish },
  ];

  {
    const legendGap = 5;
    const legendX = sidebarX;
    const legendY = tableY + sidebarHeight + legendGap;
    const legendWidth = sidebarWidth;
    const legendBottom = schoolVacationsByZone
      ? tableY + tableHeight
      : doc.internal.pageSize.getHeight() - 7;
    const legendHeight = legendBottom - legendY;
    const legendHeaderHeight = schoolVacationsByZone ? 8 : 9;
    const legendRowHeight =
      (legendHeight - legendHeaderHeight) / colorLegendItems.length;

    doc.setFillColor(248, 250, 253);
    doc.setDrawColor(125, 139, 157);
    doc.setLineWidth(0.2);
    doc.roundedRect(
      legendX,
      legendY,
      legendWidth,
      legendHeight,
      1.5,
      1.5,
      "FD",
    );
    doc.setFillColor(224, 231, 240);
    doc.roundedRect(
      legendX,
      legendY,
      legendWidth,
      legendHeaderHeight,
      1.5,
      1.5,
      "F",
    );
    // Dans les deux variantes, l'en-tête reste visuellement attaché à la
    // légende tout en étant séparé par un trait fin et net.
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(panelBorderWidth);
    doc.rect(legendX, legendY, legendWidth, legendHeaderHeight, "S");
    doc.setTextColor(...COLORS.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(schoolVacationsByZone ? 5.8 : 6.2);
    drawCenteredText(
      doc,
      "COULEURS",
      legendX,
      legendY,
      legendWidth,
      legendHeaderHeight,
    );

    colorLegendItems.forEach((item, index) => {
      const centerY =
        legendY + legendHeaderHeight + (index + 0.5) * legendRowHeight;
      const symbolX = legendX + (schoolVacationsByZone ? 3.9 : 7);
      if (item.moneyBadge) {
        doc.setFillColor(...COLORS.money);
        doc.circle(symbolX, centerY, schoolVacationsByZone ? 1.6 : 2.05, "F");
        doc.setTextColor(...COLORS.black);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(schoolVacationsByZone ? 5.8 : 6.4);
        doc.text("€", symbolX, centerY, {
          align: "center",
          baseline: "middle",
        });
      } else {
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.setDrawColor(...COLORS.black);
        doc.setLineWidth(0.2);
        const symbolWidth = schoolVacationsByZone ? 4.1 : 9.5;
        const symbolHeight = schoolVacationsByZone ? 4.1 : 4.6;
        doc.rect(symbolX - symbolWidth / 2, centerY - symbolHeight / 2, symbolWidth, symbolHeight, "FD");
        if (item.emojiType)
          drawLeaveEmoji(doc, item.emojiType, symbolX, centerY);
      }
      doc.setTextColor(...COLORS.black);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(schoolVacationsByZone ? 4.25 : 5.15);
      doc.text(item.label, legendX + (schoolVacationsByZone ? 7.4 : 13), centerY, {
        baseline: "middle",
      });
    });
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(panelBorderWidth);
    doc.roundedRect(
      legendX,
      legendY,
      legendWidth,
      legendHeight,
      1.5,
      1.5,
      "S",
    );
  }

  // Le tableau se pose juste sous la grille plutôt que de dériver vers le bas
  // de page : avec six périodes de vacances il déborderait de la feuille.
  const extraLegendY = tableY + tableHeight + 7;

  if (schoolVacationsByZone) {
    const zones = ["A", "B", "C"] as const;
    const maximumRows = Math.max(
      0,
      ...zones.map((zone) => schoolVacationsByZone[zone].length),
    );
    const tableX = sidebarX;
    const tableW = pageWidth - sidebarX - rightMargin;
    const zoneWidth = tableW / zones.length;
    const tableTop = extraLegendY - 2;
    const headerHeightRow = 6.6;
    const rowHeight = 5.2;
    const tableHeightSchool = headerHeightRow + maximumRows * rowHeight;
    const radius = 1.6;
    const zoneHeaderColors = {
      A: [67, 119, 176] as const,
      B: [73, 142, 112] as const,
      C: [190, 124, 62] as const,
    };
    const zoneRowColors = {
      A: [[235, 244, 253], [224, 237, 250]] as const,
      B: [[235, 248, 241], [224, 241, 233]] as const,
      C: [[253, 243, 232], [248, 232, 214]] as const,
    };

    doc.setFillColor(...COLORS.white);
    doc.roundedRect(tableX, tableTop, tableW, tableHeightSchool, radius, radius, "F");
    zones.forEach((zone, zoneIndex) => {
      const zoneX = tableX + zoneIndex * zoneWidth;
      const headerColor = zoneHeaderColors[zone];
      doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
      doc.rect(zoneX, tableTop, zoneWidth, headerHeightRow, "F");
      doc.setTextColor(...COLORS.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.7);
      doc.text(`Vacances scolaires · Zone ${zone}`, zoneX + zoneWidth / 2, tableTop + headerHeightRow / 2, {
        align: "center",
        baseline: "middle",
      });

      schoolVacationsByZone[zone].forEach((vacation, rowIndex) => {
        const rowY = tableTop + headerHeightRow + rowIndex * rowHeight;
        const middle = rowY + rowHeight / 2;
        const rowColor = zoneRowColors[zone][rowIndex % 2];
        doc.setFillColor(rowColor[0], rowColor[1], rowColor[2]);
        doc.rect(zoneX, rowY, zoneWidth, rowHeight, "F");
        if (rowIndex > 0) {
          doc.setDrawColor(125, 139, 157);
          doc.setLineWidth(0.28);
          doc.line(zoneX, rowY, zoneX + zoneWidth, rowY);
        }
        const shortName = vacation.name
          .replace("Vacances de la ", "")
          .replace("Vacances de ", "")
          .replace("Vacances d’", "")
          .replace("Vacances ", "");
        doc.setTextColor(...COLORS.black);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.6);
        doc.text(shortName, zoneX + 2.2, middle, { baseline: "middle" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.2);
        doc.text(
          `${frenchDate(vacation.from)} – ${frenchDate(vacation.to)}`,
          zoneX + zoneWidth - 2.2,
          middle,
          { align: "right", baseline: "middle" },
        );
      });

      if (zoneIndex > 0) {
        doc.setDrawColor(...COLORS.black);
        doc.setLineWidth(0.45);
        doc.line(zoneX, tableTop, zoneX, tableTop + tableHeightSchool);
      }
    });

    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.45);
    doc.roundedRect(tableX, tableTop, tableW, tableHeightSchool, radius, radius, "S");
  } else if (false) {
    // Bandeau Année / Groupe / Jours fériés : trois cases posées côte à côte,
    // chacune avec sa propre couleur d'en-tête et de valeur.
    const footerHeaderHeight = 6.8;
    const footerValueHeight = 7.2;
    const footerWidths = [60, 60, 60];
    const footerWidth = footerWidths.reduce((sum, width) => sum + width, 0);
    const footerStartX = (pageWidth - footerWidth) / 2;
    let footerX = footerStartX;
    const footerCells = [
      {
        label: "Année",
        valueLines: [String(year)],
        valueFontSize: 7.8,
        inlineEuroBadge: false,
        headerColor: COLORS.yearHeader,
        valueColor: COLORS.yearValue,
      },
      {
        label: "Groupe",
        valueLines: [String(group)],
        valueFontSize: 7.8,
        inlineEuroBadge: false,
        headerColor: COLORS.groupHeader,
        valueColor: COLORS.groupValue,
      },
      {
        label: "Jours fériés",
        valueLines:
          offeredHolidayCount > 0
            ? [
                `${workedHolidayCount} ${workedHolidayCount === 1 ? "férié" : "fériés"} + ${offeredHolidayCount} ${offeredHolidayCount === 1 ? "offert" : "offerts"} en ${year + 1}`,
              ]
            : [
                `${workedHolidayCount} ${workedHolidayCount === 1 ? "férié" : "fériés"}`,
              ],
        valueFontSize: offeredHolidayCount > 0 ? 5.9 : 7.8,
        inlineEuroBadge: offeredHolidayCount > 0,
        headerColor: COLORS.holidaysHeader,
        valueColor: COLORS.holidaysValue,
      },
    ];

    for (let index = 0; index < footerCells.length; index++) {
      const cell = footerCells[index];
      const width = footerWidths[index];
      doc.setFillColor(
        cell.headerColor[0],
        cell.headerColor[1],
        cell.headerColor[2],
      );
      doc.setDrawColor(...COLORS.black);
      doc.setLineWidth(0.45);
      doc.rect(footerX, extraLegendY, width, footerHeaderHeight, "FD");
      doc.setFillColor(
        cell.valueColor[0],
        cell.valueColor[1],
        cell.valueColor[2],
      );
      doc.rect(
        footerX,
        extraLegendY + footerHeaderHeight,
        width,
        footerValueHeight,
        "FD",
      );
      doc.setTextColor(...COLORS.black);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      drawCenteredText(
        doc,
        cell.label,
        footerX,
        extraLegendY,
        width,
        footerHeaderHeight,
      );
      const valueCenterY =
        extraLegendY + footerHeaderHeight + footerValueHeight / 2;
      if (cell.inlineEuroBadge) {
        const prefix = `${cell.valueLines[0]} (`;
        const suffix = " sur planning)";
        const badgeRadius = 1.15;
        const badgeGap = 0.35;
        let fontSize = 5.2;
        let prefixWidth = 0;
        let suffixWidth = 0;
        let totalWidth = 0;
        do {
          doc.setFontSize(fontSize);
          prefixWidth = doc.getTextWidth(prefix);
          suffixWidth = doc.getTextWidth(suffix);
          totalWidth =
            prefixWidth + suffixWidth + badgeRadius * 2 + badgeGap * 2;
          fontSize -= 0.1;
        } while (totalWidth > width - 3 && fontSize >= 4.2);
        const startX = footerX + (width - totalWidth) / 2;
        doc.text(prefix, startX, valueCenterY, { baseline: "middle" });
        const badgeCenterX = startX + prefixWidth + badgeGap + badgeRadius;
        doc.setFillColor(...COLORS.money);
        doc.circle(badgeCenterX, valueCenterY, badgeRadius, "F");
        doc.setTextColor(...COLORS.black);
        doc.setFontSize(4.8);
        doc.text("€", badgeCenterX, valueCenterY, {
          align: "center",
          baseline: "middle",
        });
        doc.setFontSize(fontSize + 0.1);
        doc.text(suffix, badgeCenterX + badgeRadius + badgeGap, valueCenterY, {
          baseline: "middle",
        });
      } else {
        const valueLineGap = 2.45;
        doc.setFontSize(cell.valueFontSize);
        cell.valueLines.forEach((line, lineIndex) => {
          doc.text(
            line,
            footerX + width / 2,
            valueCenterY +
              (lineIndex - (cell.valueLines.length - 1) / 2) * valueLineGap,
            { align: "center", baseline: "middle" },
          );
        });
      }
      footerX += width;
    }
  }

}

export function createAnnualPlanningPdf({
  year,
  groups,
  getDayInfo,
  wasPompidouHolidayWorked,
  leaveTypes,
  halfMoments,
  schoolVacationDates,
  wishDates,
  schoolVacationsByZone,
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
      schoolVacationDates,
      wishDates,
      schoolVacationsByZone,
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
  firstYear = 2026,
  lastYear = 2031,
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
