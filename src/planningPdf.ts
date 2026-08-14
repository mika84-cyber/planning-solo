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
  | "childcare"
  | "exceptional";
/** Moitié posée sur une demi-journée. Absent pour les demi-journées venues du
 *  formulaire, qui n'en portent pas : la case est alors coloriée à gauche. */
type PdfHalfMoment = "morning" | "afternoon";
/** La demi-journée n'y figure pas : sa case n'est pas légendée, sa moitié
 *  colorée suffit. */
const LEAVE_CODES: Record<Exclude<PdfLeaveType, "half">, string> = {
  annual: "CA",
  rtt: "RTT",
  fraction: "F",
  recovery: "Récup",
  sick: "Maladie",
  childcare: "Congé enf.",
  exceptional: "Congé exp.",
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
  /** Vacances scolaires de l'année, pour le tableau récapitulatif. */
  schoolVacations?: Array<{ name: string; from: string; to: string }>;
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
  leave: [74, 190, 241] as const,
  /** Récupération : violet doux. Elle ne se décompte pas comme un congé, donc
   *  elle ne reprend pas son bleu. */
  recovery: [206, 189, 240] as const,
  /** Barre des vacances scolaires, dans la marge gauche de la colonne. */
  schoolVacation: [32, 185, 107] as const,
  /** Fond des congés souhaités : vert clair, pour rester lisible sous le
   *  texte noir des dates. */
  wish: [178, 233, 199] as const,
  money: [242, 174, 39] as const,
  /** Bleu ardoise du tableau des vacances : sobre, il ferme la page sans
   *  reprendre une couleur déjà porteuse de sens dans la grille. */
  slate: [45, 62, 84] as const,
  slateLine: [214, 223, 235] as const,
};

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

/** La clé du jour décalé de `days`, pour tester les bornes d'une période. */
function shiftKey(key: string, days: number) {
  return new Date(Date.parse(`${key}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
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
  leaveSummary?: PlanningPdfOptions["leaveSummary"],
  schoolVacationDates?: ReadonlySet<string>,
  wishDates?: ReadonlySet<string>,
  schoolVacations?: PlanningPdfOptions["schoolVacations"],
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 24;
  const tableY = 8;
  const tableWidth = pageWidth - marginX * 2;
  const monthWidth = tableWidth / 12;
  const headerHeight = 9;
  const dayHeight = 4.75;
  const tableHeight = headerHeight + 31 * dayHeight;
  const blackOutlineWidth = 0.35;
  const redLineWidth = 0.55;
  const monthBottoms: number[] = [];
  let workedHolidayCount = 0;
  let offeredHolidayCount = 0;

  doc.setLineJoin("miter");
  doc.setLineCap("butt");

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
      const leaveType =
        !info.holiday && !isOff ? leaveTypes?.get(key) : undefined;
      return {
        date,
        info,
        isOff,
        leaveType,
        halfMoment: leaveType === "half" ? halfMoments?.get(key) : undefined,
        // La récupération a son propre encadré : la laisser hors des congés
        // pleins évite qu'elle se fonde dans la bordure d'une période voisine.
        isRecovery: leaveType === "recovery",
        isFullLeave: Boolean(
          leaveType && leaveType !== "half" && leaveType !== "recovery",
        ),
        isSchoolVacation: Boolean(schoolVacationDates?.has(key)),
        // Bornes de la période : marquer les trente jours d'affilée noyait
        // l'information, alors que le début et la fin sont ce qu'on cherche.
        isSchoolVacationStart: Boolean(
          schoolVacationDates?.has(key) &&
            !schoolVacationDates.has(shiftKey(key, -1)),
        ),
        isSchoolVacationEnd: Boolean(
          schoolVacationDates?.has(key) &&
            !schoolVacationDates.has(shiftKey(key, 1)),
        ),
        isWish: Boolean(wishDates?.has(key)),
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
        isSchoolVacationStart,
        isSchoolVacationEnd,
        isWish,
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
            ? COLORS.leave
            : isOff
              ? COLORS.black
              : isWorkedHoliday
                ? COLORS.holiday
                : info.kind === "training"
                  ? COLORS.training
                  : COLORS.white;
      const darkCell = isOff && !isWish;
      const textColor = darkCell ? COLORS.white : COLORS.black;
      if (isWorkedHoliday) workedHolidayCount++;
      if (isOfferedHoliday) offeredHolidayCount++;

      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(...COLORS.black);
      doc.setLineWidth(0.18);
      if (isFullLeave) {
        doc.rect(x, y, monthWidth, dayHeight, "F");
        doc.line(x, y, x, y + dayHeight);
        doc.line(x + monthWidth, y, x + monthWidth, y + dayHeight);
        if (!monthDays[day - 2]?.isFullLeave) doc.line(x, y, x + monthWidth, y);
        if (!monthDays[day]?.isFullLeave)
          doc.line(x, y + dayHeight, x + monthWidth, y + dayHeight);
      } else {
        // La récupération garde son encadré à elle, jour par jour : elle ne se
        // fond pas dans la période voisine comme le font les congés pleins.
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
      // Bornes des vacances : un triangle posé sur la bordure haute du premier
      // jour, sur la bordure basse du dernier. Il tient dans l'épaisseur du
      // trait, donc n'empiète sur rien. Un contour blanc le détache quand la
      // case est noire.
      if (isSchoolVacationStart || isSchoolVacationEnd) {
        const half = 1.5;
        const depth = 1.7;
        // Sur un jour férié, la mention « Férié » suit la date jusqu'au milieu
        // de la case : le triangle se décale vers la droite pour la laisser.
        const centerX = info.holiday
          ? x + monthWidth * 0.78
          : x + monthWidth / 2;
        const edgeY = isSchoolVacationStart ? y : y + dayHeight;
        const tipY = isSchoolVacationStart ? y + depth : y + dayHeight - depth;
        // Noir sur les fonds clairs, blanc sur le noir des repos : le repère
        // se lit par contraste plutôt que par couleur, donc il survit aussi
        // à une impression en noir et blanc.
        const markColor = darkCell ? COLORS.white : COLORS.black;
        doc.setDrawColor(markColor[0], markColor[1], markColor[2]);
        doc.setLineWidth(0.1);
        doc.setFillColor(markColor[0], markColor[1], markColor[2]);
        doc.triangle(
          centerX - half,
          edgeY,
          centerX + half,
          edgeY,
          centerX,
          tipY,
          "FD",
        );
      }
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
      // La demi-journée n'est pas légendée : la moitié bleue et son trait
      // médian disent déjà ce qu'il y a à savoir.
      if (leaveType && leaveType !== "half") {
        const code = LEAVE_CODES[leaveType];
        // Les mentions sont décalées de 2 mm vers la gauche du trait
        // d'encadrement.
        const codeRight = x + monthWidth - 0.9 - 2;
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

  // Le tableau des vacances scolaires (groupe avec congés) et le bandeau
  // année / groupe / fériés (les deux autres exports) se partagent la même
  // place sous la grille : le premier dit déjà où et quand tombent les
  // vacances, le second n'a de sens que quand ce tableau est absent.
  // Le tableau se pose juste sous la grille plutôt que de dériver vers le bas
  // de page : avec six périodes de vacances il déborderait de la feuille.
  const extraLegendY = tableY + tableHeight + 7;

  if (schoolVacations?.length) {
    // Un tableau plutôt qu'une ligne de légende : les repères « Vac » de la
    // grille disent où commencent et finissent les périodes, celui-ci dit
    // lesquelles et à quelles dates.
    const headerHeightRow = 6;
    const rowHeight = 5.4;
    const namePad = 4;
    const nameWidth = 58;
    const dateWidth = 26;
    const tableW = nameWidth + dateWidth * 2;
    const tableX = (pageWidth - tableW) / 2;
    const tableTop = extraLegendY - 2;
    const tableBottom =
      tableTop + headerHeightRow + schoolVacations.length * rowHeight;
    const radius = 1.6;

    // Fond blanc arrondi posé avant tout le reste : les filets internes se
    // dessinent ensuite par-dessus, sans cadre noir qui alourdirait le bloc.
    doc.setFillColor(...COLORS.white);
    doc.roundedRect(
      tableX,
      tableTop,
      tableW,
      tableBottom - tableTop,
      radius,
      radius,
      "F",
    );

    doc.setFillColor(...COLORS.slate);
    doc.roundedRect(
      tableX,
      tableTop,
      tableW,
      headerHeightRow,
      radius,
      radius,
      "F",
    );
    // Le bas de l'en-tête reprend un angle droit pour se raccorder aux lignes.
    doc.rect(tableX, tableTop + headerHeightRow - radius, tableW, radius, "F");

    doc.setTextColor(...COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    const headerMiddle = tableTop + headerHeightRow / 2;
    doc.text("Vacances scolaires · zone C", tableX + namePad, headerMiddle, {
      baseline: "middle",
    });
    doc.setFontSize(5.6);
    doc.text("Début", tableX + nameWidth + dateWidth - 3, headerMiddle, {
      align: "right",
      baseline: "middle",
    });
    doc.text("Fin", tableX + tableW - 3, headerMiddle, {
      align: "right",
      baseline: "middle",
    });

    let rowY = tableTop + headerHeightRow;
    for (const [index, vacation] of schoolVacations.entries()) {
      const middle = rowY + rowHeight / 2;
      if (index % 2) {
        doc.setFillColor(246, 248, 251);
        doc.rect(tableX, rowY, tableW, rowHeight, "F");
      }
      if (index > 0) {
        doc.setDrawColor(...COLORS.slateLine);
        doc.setLineWidth(0.15);
        doc.line(tableX + namePad, rowY, tableX + tableW - namePad, rowY);
      }
      doc.setTextColor(...COLORS.black);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.text(vacation.name, tableX + namePad, middle, {
        baseline: "middle",
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.text(
        frenchDate(vacation.from),
        tableX + nameWidth + dateWidth - 3,
        middle,
        { align: "right", baseline: "middle" },
      );
      doc.text(frenchDate(vacation.to), tableX + tableW - 3, middle, {
        align: "right",
        baseline: "middle",
      });
      rowY += rowHeight;
    }

    // Contour vert discret plutôt qu'un trait noir : il ferme le bloc sans
    // rivaliser avec la grille du planning.
    doc.setDrawColor(...COLORS.slateLine);
    doc.setLineWidth(0.3);
    doc.roundedRect(
      tableX,
      tableTop,
      tableW,
      tableBottom - tableTop,
      radius,
      radius,
      "S",
    );
  } else {
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
  leaveSummary,
  schoolVacationDates,
  wishDates,
  schoolVacations,
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
      leaveSummary,
      schoolVacationDates,
      wishDates,
      schoolVacations,
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
