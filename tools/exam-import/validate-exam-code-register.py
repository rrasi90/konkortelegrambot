#!/usr/bin/env python3
"""Validate the year-by-year exam-code register (staging-only artifact).

Checks structural invariants that come straight from the official guides:
- every year 1396..1405 has an official guide with a 64-hex SHA-256 and page anchors,
- 1396-1402 use separate exam-set codes and confirm the full 2162-2171 family,
- 1403-1405 use the umbrella 2162 with combination-table evidence,
- restrictions on 2166/2168 and adjacent/excluded classifications stay intact,
- corrections and crosswalk records exist with evidence,
- the register stays staging-only (no answer keys, no production fields).
"""
import argparse
import json
import re
import sys
from pathlib import Path

SHA_RE = re.compile(r"^[0-9a-f]{64}$")
YEARS = [str(y) for y in range(1396, 1406)]
REQUIRED_CORRECTIONS = {
    "corr-1400-accounting-code",
    "corr-1399-2143-confirmed",
    "corr-1396-code-structure",
}
FAMILY = {"2162", "2163", "2164", "2165", "2167", "2169"}
FORBIDDEN_KEYS = {
    "answerKey", "answers", "correctOption", "questionText", "allowedUse",
    "publicationStatus", "productionServable",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--register", type=Path, required=True)
    args = ap.parse_args()
    reg = json.loads(args.register.read_text(encoding="utf-8"))
    errors = []

    phd = reg.get("phdManagementFamily", {})
    if sorted(phd.keys()) != YEARS:
        errors.append(f"PhD family must cover exactly {YEARS}, got {sorted(phd.keys())}")

    for year in YEARS:
        entry = phd.get(year) or {}
        guide = entry.get("officialGuide") or {}
        sha = guide.get("sha256", "")
        if not SHA_RE.match(sha):
            errors.append(f"{year}: guide sha256 missing/invalid")
        if not guide.get("sourceUrl"):
            errors.append(f"{year}: guide sourceUrl missing")
        if not (10 < int(guide.get("pageCount", 0)) < 400):
            errors.append(f"{year}: implausible guide pageCount {guide.get('pageCount')}")
        rows = entry.get("rows") or {}
        if not rows:
            errors.append(f"{year}: no code rows")
        for code in ("2166", "2168"):
            if code in rows and rows[code].get("classification") not in (
                "specialist_restricted_adjacent", "specialist_adjacent"
            ):
                errors.append(f"{year}: {code} classification lost")
        structure = entry.get("structure")
        if year <= "1402" and structure != "separate_exam_set_codes":
            errors.append(f"{year}: expected separate_exam_set_codes, got {structure}")
        if year >= "1403" and structure != "umbrella_2162_with_course_combination_codes":
            errors.append(f"{year}: expected umbrella structure, got {structure}")
        if year >= "1403" and rows.get("2162", {}).get("officialTitle") != "مدیریت":
            errors.append(f"{year}: umbrella 2162 title must be «مدیریت»")
        if year >= "1403":
            combo = entry.get("combinationTablePages") or {}
            if not combo.get("combinationPages") or not combo.get("rawEvidence"):
                errors.append(f"{year}: combination-table evidence missing")

    for year in ("1396", "1397", "1398", "1399", "1400", "1401", "1402"):
        codes = set((phd.get(year) or {}).get("rows", {}).keys())
        missing = FAMILY - codes
        if missing:
            errors.append(f"{year}: family codes missing {sorted(missing)}")
        if "2171" not in codes:
            errors.append(f"{year}: 2171 مالی missing")

    corrections = {c.get("correctionId") for c in reg.get("corrections", [])}
    missing_corr = REQUIRED_CORRECTIONS - corrections
    if missing_corr:
        errors.append(f"corrections missing {sorted(missing_corr)}")

    crosswalk = reg.get("crosswalk", [])
    if not any(c.get("type") == "consolidation" for c in crosswalk):
        errors.append("crosswalk: consolidation record missing")
    if not any(c.get("type") == "title_change" for c in crosswalk):
        errors.append("crosswalk: title_change records missing")

    msc = reg.get("mscManagement1142") or {}
    units = msc.get("yearUnits") or {}
    if sorted(units.keys()) != YEARS:
        errors.append(f"MSC 1142 yearUnits must cover {YEARS}")

    def scan(obj, path):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in FORBIDDEN_KEYS:
                    errors.append(f"forbidden key {k} at {path}.{k}")
                scan(v, path + "." + str(k))
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                scan(v, f"{path}[{i}]")

    scan(reg, "register")

    if errors:
        print("\n".join(errors))
        return 1
    print(json.dumps({
        "valid": True,
        "phdYears": len(phd),
        "mscYearUnits": len(units),
        "corrections": len(reg.get("corrections", [])),
        "crosswalkRecords": len(crosswalk),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
