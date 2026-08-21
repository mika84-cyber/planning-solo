import csv
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber


ARCHIVE = Path(r"D:\Downloads\archive_09-Aug-2026_01_30_40.851277_6767365_mypeopledoc")
OUT = Path(r"D:\Downloads\planning-solo\tmp\pdfs\payslip-analysis.csv")
FIXED_RATE = 79.41 / 100
VARIABLE_RATE = 89.92 / 100
PAS_ADJUSTMENT = 1.057


def clean(value: str) -> str:
    value = value.replace("�", "e")
    return "".join(
        char
        for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    ).lower()


def numbers(value: str):
    return [float(item.replace(",", ".")) for item in re.findall(r"-?\d+[.,]\d+", value)]


def lines_for_code(lines, code):
    marker = f" {code} "
    return [line for line in lines if marker in f" {line} "]


def last_for_code(lines, code, default=0.0):
    matches = lines_for_code(lines, code)
    if not matches:
        return default
    values = numbers(matches[0])
    return values[-1] if values else default


def sum_last_for_code(lines, code):
    total = 0.0
    for line in lines_for_code(lines, code):
        values = numbers(line)
        if values:
            total += values[-1]
    return round(total, 2)


def first_amount_after(lines, label):
    for line in lines:
        if label in clean(line):
            values = numbers(line)
            return values[-1] if values else None
    return None


def parse_pdf(path: Path):
    with pdfplumber.open(path) as pdf:
        pages = [(page.extract_text() or "").splitlines() for page in pdf.pages]
    lines = [line for page in pages for line in page]
    page1 = pages[0]
    page2 = pages[-1]

    period_match = re.search(r"(20\d{2})-(\d{2})-01", path.name)
    year, month = map(int, period_match.groups())

    gross = first_amount_after(page1, "cumul brut")
    net_before = None
    net_paid = None
    for index, line in enumerate(page2):
        normalized = clean(line)
        if "net a payer avant impot" in normalized:
            for candidate in page2[index + 1:index + 5]:
                values = numbers(candidate)
                if "en euros" in clean(candidate) and values:
                    net_before = values[-1]
                    break
        if normalized.strip().startswith("net a payer") and "avant" not in normalized:
            for candidate in page2[index:index + 4]:
                values = numbers(candidate)
                if "en euros" in clean(candidate) and values:
                    net_paid = values[-1]
                    break

    base = last_for_code(page1, "300.00")
    residence = last_for_code(page1, "308.00")
    smic = last_for_code(page1, "310.00")
    ichcsg = last_for_code(page1, "636.83")
    mgen_option_aid = last_for_code(page1, "639.54")
    ifse = last_for_code(page1, "641.28")
    transfer = last_for_code(page1, "641.29")
    carence = abs(last_for_code(page1, "648.60"))
    navigo = last_for_code(page1, "823.22")
    meals = abs(last_for_code(page1, "870.02"))
    pas_rate = last_for_code(page1, "884.71")
    fixed = round(base + residence + smic + ichcsg + mgen_option_aid + ifse + transfer - carence, 2)
    variable = round(gross - fixed, 2) if gross is not None else None
    estimated_before = (
        fixed * FIXED_RATE + variable * VARIABLE_RATE + navigo - meals
        if variable is not None
        else None
    )
    estimated_paid = (
        estimated_before * (1 - (pas_rate / 100) * PAS_ADJUSTMENT)
        if estimated_before is not None
        else None
    )

    mgen_fixed = sum_last_for_code(page1, "794.28")
    mgen_solidarity = sum_last_for_code(page1, "794.29")
    mgen_retiree = sum_last_for_code(page1, "794.38")
    mgen_social = sum_last_for_code(page1, "794.39")
    mgen_employee = round(mgen_fixed + mgen_solidarity + mgen_retiree + mgen_social, 2)
    mgen_employer = sum_last_for_code(page1, "925.08")

    return {
        "period": f"{year:04d}-{month:02d}",
        "gross": gross,
        "fixed": fixed,
        "variable": variable,
        "net_before_actual": net_before,
        "net_before_estimated": round(estimated_before, 2) if estimated_before is not None else None,
        "net_before_diff": round(estimated_before - net_before, 2) if estimated_before is not None and net_before is not None else None,
        "net_paid_actual": net_paid,
        "net_paid_estimated": round(estimated_paid, 2) if estimated_paid is not None else None,
        "net_paid_diff": round(estimated_paid - net_paid, 2) if estimated_paid is not None and net_paid is not None else None,
        "pas_rate": pas_rate,
        "mgen_option_aid": mgen_option_aid,
        "mgen_fixed": mgen_fixed,
        "mgen_solidarity": mgen_solidarity,
        "mgen_retiree": mgen_retiree,
        "mgen_social": mgen_social,
        "mgen_employee_total": mgen_employee,
        "mgen_employer": mgen_employer,
        "carence": carence,
        "navigo": navigo,
        "meals": meals,
    }


rows = [parse_pdf(path) for path in sorted(ARCHIVE.glob("bulletin-de-salaire-*.pdf"))]
with OUT.open("w", newline="", encoding="utf-8-sig") as stream:
    writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

valid = [row for row in rows if row["net_paid_diff"] is not None]
pre_mgen = [row for row in valid if row["mgen_employee_total"] == 0]
with_mgen = [row for row in valid if row["mgen_employee_total"] > 0]


def stats(group):
    if not group:
        return None
    diffs = [row["net_paid_diff"] for row in group]
    return {
        "count": len(group),
        "mean_signed": round(sum(diffs) / len(diffs), 2),
        "mean_absolute": round(sum(abs(value) for value in diffs) / len(diffs), 2),
        "max_absolute": round(max(abs(value) for value in diffs), 2),
        "worst_period": max(group, key=lambda row: abs(row["net_paid_diff"]))["period"],
    }


print(json.dumps({
    "count": len(rows),
    "period": [rows[0]["period"], rows[-1]["period"]],
    "mgen_first": next((row["period"] for row in rows if row["mgen_employee_total"] > 0), None),
    "mgen_months": [
        {key: row[key] for key in (
            "period", "mgen_option_aid", "mgen_fixed", "mgen_solidarity",
            "mgen_retiree", "mgen_social", "mgen_employee_total", "mgen_employer",
            "net_paid_diff"
        )}
        for row in rows if row["mgen_employee_total"] > 0
    ],
    "stats_all": stats(valid),
    "stats_pre_mgen": stats(pre_mgen),
    "stats_with_mgen": stats(with_mgen),
    "largest_differences": [
        {key: row[key] for key in ("period", "net_paid_actual", "net_paid_estimated", "net_paid_diff", "gross", "pas_rate", "mgen_employee_total")}
        for row in sorted(valid, key=lambda row: abs(row["net_paid_diff"]), reverse=True)[:8]
    ],
    "rows": rows,
}, ensure_ascii=False, indent=2))
