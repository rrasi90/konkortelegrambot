#!/usr/bin/env python3
"""OCR management exam booklets (Persian + English) into editable DOCX files."""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from datetime import datetime, timezone
import fitz
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

SOURCE_COMMIT = "3d8a7031ffcd6dba450115a1f7f901ce4087fade"
RAR_PASSWORD = "www.konkur.in"
LANG = "fas+eng"

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def set_rtl(paragraph) -> None:
    ppr = paragraph._p.get_or_add_pPr()
    bidi = ppr.find(qn("w:bidi"))
    if bidi is None:
        bidi = OxmlElement("w:bidi")
        ppr.append(bidi)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT

def set_run_rtl(run) -> None:
    rpr = run._r.get_or_add_rPr()
    rtl = rpr.find(qn("w:rtl"))
    if rtl is None:
        rtl = OxmlElement("w:rtl")
        rpr.append(rtl)
    lang = rpr.find(qn("w:lang"))
    if lang is None:
        lang = OxmlElement("w:lang")
        rpr.append(lang)
    lang.set(qn("w:val"), "fa-IR")
    lang.set(qn("w:eastAsia"), "fa-IR")

def set_run_font(run, name="Noto Naskh Arabic", size=11, bold=None):
    run.font.name = name
    run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    rpr = run._r.get_or_add_rPr()
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
        rfonts.set(qn(f"w:{attr}"), name)
    set_run_rtl(run)

def configure_document(doc: Document, title: str, source_name: str):
    section = doc.sections[0]
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    normal = doc.styles["Normal"]
    normal.font.name = "Noto Naskh Arabic"
    normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(4)
    normal.paragraph_format.line_spacing = 1.12
    for style_name in ("Title", "Heading 1", "Heading 2"):
        st = doc.styles[style_name]
        st.font.name = "Noto Naskh Arabic"
        st._element.rPr.rFonts.set(qn("w:cs"), "Noto Naskh Arabic")
        st._element.rPr.rFonts.set(qn("w:eastAsia"), "Noto Naskh Arabic")
    doc.core_properties.title = title
    doc.core_properties.subject = "OCR output of management entrance-exam question booklet"
    doc.core_properties.keywords = "OCR, Persian, management, exam booklet, 1142, 2162"
    doc.core_properties.comments = (
        "Automatically generated with Tesseract fas+eng. Verify all questions, "
        "options, numbers and formulas against the source PDF."
    )
    header = section.header.paragraphs[0]
    header.text = title
    set_rtl(header)
    for r in header.runs:
        set_run_font(r, size=8, bold=True)
    footer = section.footer.paragraphs[0]
    footer.text = f"منبع: {source_name} | متن OCR است و باید با PDF تطبیق داده شود."
    set_rtl(footer)
    for r in footer.runs:
        set_run_font(r, size=8)

def normalize_ocr(text: str) -> str:
    text = text.replace("\x0c", "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    cleaned, blank = [], False
    for line in lines:
        if not line:
            if not blank:
                cleaned.append("")
            blank = True
        else:
            cleaned.append(line)
            blank = False
    return "\n".join(cleaned).strip()

def ocr_page(page, page_index: int, temp_dir: Path, dpi: int) -> str:
    scale = dpi / 72.0
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False, colorspace=fitz.csGRAY)
    raw_path = temp_dir / f"page-{page_index:04d}-raw.png"
    proc_path = temp_dir / f"page-{page_index:04d}.png"
    pix.save(raw_path)
    with Image.open(raw_path) as im:
        im = ImageOps.autocontrast(im.convert("L"), cutoff=1)
        im = ImageEnhance.Contrast(im).enhance(1.18).filter(ImageFilter.SHARPEN)
        im.save(proc_path, dpi=(dpi, dpi))
    base = ["tesseract", str(proc_path), "stdout", "-l", LANG, "--psm", "3",
            "-c", "preserve_interword_spaces=1"]
    try:
        run = subprocess.run(base, capture_output=True, text=True, timeout=180, check=False)
        text = normalize_ocr(run.stdout)
        if len(text.split()) < 5:
            fallback = base.copy()
            fallback[fallback.index("--psm") + 1] = "6"
            run2 = subprocess.run(fallback, capture_output=True, text=True, timeout=180, check=False)
            candidate = normalize_ocr(run2.stdout)
            if len(candidate) > len(text):
                text = candidate
        return text
    finally:
        raw_path.unlink(missing_ok=True)
        proc_path.unlink(missing_ok=True)

def add_page_text(doc: Document, page_no: int, page_count: int, text: str):
    heading = doc.add_paragraph(style="Heading 2")
    heading.paragraph_format.keep_with_next = True
    heading.paragraph_format.space_before = Pt(9)
    heading.paragraph_format.space_after = Pt(3)
    run = heading.add_run(f"صفحه {page_no} از {page_count} — منبع PDF")
    set_run_font(run, size=12, bold=True)
    set_rtl(heading)
    if not text:
        p = doc.add_paragraph()
        set_rtl(p)
        r = p.add_run("[متنی توسط OCR شناسایی نشد؛ این صفحه نیازمند بازبینی دستی است.]")
        set_run_font(r, size=10, bold=True)
        return
    for block in re.split(r"\n\s*\n", text):
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        p = doc.add_paragraph()
        p.paragraph_format.widow_control = True
        p.paragraph_format.space_after = Pt(3)
        set_rtl(p)
        for i, line in enumerate(lines):
            run = p.add_run(line)
            set_run_font(run, size=10.5)
            if i != len(lines) - 1:
                run.add_break()

def build_docx(pdf_path: Path, output_path: Path, level: str, code: str, year: int, dpi: int) -> dict:
    level_title = "کارشناسی ارشد مدیریت" if level == "arshad" else "دکتری مدیریت"
    title = f"دفترچه کنکور {level_title} — کد {code} — سال {year}"
    doc = Document()
    configure_document(doc, title, pdf_path.name)
    p = doc.add_paragraph(style="Title")
    set_rtl(p)
    r = p.add_run(title)
    set_run_font(r, size=18, bold=True)
    p = doc.add_paragraph()
    set_rtl(p)
    r = p.add_run(
        f"فایل مبدأ: {pdf_path.name}\n"
        f"روش استخراج: OCR فارسی و انگلیسی (Tesseract {LANG})\n"
        "هشدار دقت: متن OCR پیش‌نویس استخراج است؛ اعداد، گزینه‌ها، فرمول‌ها و علائم "
        "باید با تصویر PDF تطبیق داده شوند."
    )
    set_run_font(r, size=9)
    doc.add_page_break()
    page_reports = []
    with fitz.open(pdf_path) as pdf:
        total = pdf.page_count
        with tempfile.TemporaryDirectory(prefix="exam-ocr-") as td:
            td_path = Path(td)
            for idx, page in enumerate(pdf, start=1):
                txt = ocr_page(page, idx, td_path, dpi)
                add_page_text(doc, idx, total, txt)
                words = len(txt.split())
                page_reports.append({
                    "pdf_page": idx, "word_count": words, "characters": len(txt),
                    "status": "REVIEW" if words < 12 else "OCR_DONE"
                })
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)
    return {
        "level": level, "exam_code": code, "year": year,
        "source_pdf": pdf_path.name, "source_sha256": sha256(pdf_path),
        "docx": str(output_path), "pages": len(page_reports),
        "ocr_words": sum(x["word_count"] for x in page_reports),
        "review_pages": [x["pdf_page"] for x in page_reports if x["status"] == "REVIEW"],
        "page_reports": page_reports,
    }

def extract_ma_1396_rar(source_dir: Path, work_dir: Path) -> list[Path]:
    archives = list(source_dir.glob("MA_1142_1396.rar"))
    if not archives:
        return []
    archive = archives[0]
    out = work_dir / "ma-1396-rar"
    out.mkdir(parents=True, exist_ok=True)
    attempts = []
    if shutil.which("7zz"):
        attempts.append(["7zz", "x", f"-p{RAR_PASSWORD}", f"-o{out}", "-y", str(archive)])
    if shutil.which("7z"):
        attempts.append(["7z", "x", f"-p{RAR_PASSWORD}", f"-o{out}", "-y", str(archive)])
    if shutil.which("unar"):
        attempts.append(["unar", "-p", RAR_PASSWORD, "-o", str(out), str(archive)])
    for cmd in attempts:
        subprocess.run(cmd, capture_output=True, text=True, timeout=300, check=False)
        extracted = list(out.rglob("*.pdf"))
        if extracted:
            return extracted
    raise RuntimeError("MA_1142_1396.rar exists, but extraction failed.")

def collect_inputs(source_dir: Path, work_dir: Path):
    selected = []
    try:
        extracted = extract_ma_1396_rar(source_dir, work_dir)
        ma96 = [p for p in extracted if "KEY" not in p.name.upper()]
        if ma96:
            preferred = next((p for p in ma96 if "1396" in p.name), ma96[0])
            selected.append(("arshad", "1142", 1396, preferred))
    except Exception as exc:
        print(f"WARNING: MA 1396 archive not converted: {exc}", file=sys.stderr)
    for year in range(1397, 1406):
        path = source_dir / f"MA_1142_{year}.pdf"
        if path.exists():
            selected.append(("arshad", "1142", year, path))
    for year in range(1396, 1406):
        if year == 1403:
            names = ["PhD_2162_1403_620c.pdf", "PhD_2162_1403.pdf"]
        elif year in (1404, 1405):
            names = [f"PhD_2162_{year}_official.pdf", f"PhD_2162_{year}.pdf"]
        else:
            names = [f"PhD_2162_{year}.pdf"]
        seen = set()
        for name in names:
            path = source_dir / name
            if path.exists():
                digest = sha256(path)
                if digest not in seen:
                    seen.add(digest)
                    selected.append(("phd", "2162", year, path))
    return selected

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-dir", required=True, type=Path)
    ap.add_argument("--output-dir", required=True, type=Path)
    ap.add_argument("--dpi", type=int, default=250)
    args = ap.parse_args()
    langs = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True, check=True)
    if "fas" not in langs.stdout.split():
        raise SystemExit("Tesseract Persian language data (fas) is not installed.")
    if not (args.source_dir / "MA_1142_1397.pdf").exists():
        raise SystemExit(f"Source directory missing MA PDFs: {args.source_dir}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    work_dir = args.output_dir / "_work"
    work_dir.mkdir(exist_ok=True)
    records, errors = [], []
    inputs = collect_inputs(args.source_dir, work_dir)
    for level, code, year, pdf_path in inputs:
        folder = "1142" if level == "arshad" else "2162"
        stem = f"{folder}-{year}"
        already = list((args.output_dir / folder).glob(f"{stem}*.docx"))
        suffix = f"-variant{len(already) + 1}" if already else ""
        out = args.output_dir / folder / f"{stem}{suffix}.docx"
        try:
            print(f"OCR_START {folder} {year} {pdf_path.name}", flush=True)
            record = build_docx(pdf_path, out, level, code, year, args.dpi)
            records.append(record)
            print(f"OCR_DONE {folder} {year}: pages={record['pages']} words={record['ocr_words']} review_pages={len(record['review_pages'])}", flush=True)
        except Exception as exc:
            errors.append({"source_pdf": pdf_path.name, "error": str(exc)})
            print(f"OCR_ERROR {pdf_path.name}: {exc}", file=sys.stderr, flush=True)
    lines = [
        "# خروجی OCR دفترچه‌های کنکور مدیریت", "",
        f"- تاریخ تولید: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f"- موتور OCR: Tesseract ({LANG})", f"- وضوح رندر: {args.dpi} DPI",
        "- دامنه: دفترچه‌های سؤال ارشد ۱۱۴۲ و دکتری ۲۱۶۲؛ فایل‌های KEY عمداً وارد نشده‌اند.",
        "- هشدار: OCR جایگزین بازبینی PDF اصلی نیست؛ عددها، گزینه‌ها، فرمول‌ها و جداول باید تطبیق داده شوند.", "",
        "| مقطع | سال | فایل منبع | صفحات | واژه OCR | صفحات نیازمند بازبینی | فایل Word |",
        "|---|---:|---|---:|---:|---|---|",
    ]
    for r in records:
        label = "ارشد ۱۱۴۲" if r["level"] == "arshad" else "دکتری ۲۱۶۲"
        flagged = ", ".join(map(str, r["review_pages"])) if r["review_pages"] else "—"
        relpath = Path(r["docx"]).relative_to(args.output_dir)
        lines.append(f"| {label} | {r['year']} | {r['source_pdf']} | {r['pages']} | {r['ocr_words']} | {flagged} | {relpath} |")
    if errors:
        lines.extend(["", "## فایل‌های ناموفق", ""])
        lines.extend([f"- {e['source_pdf']}: {e['error']}" for e in errors])
    (args.output_dir / "OCR-INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    manifest = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_commit": SOURCE_COMMIT, "ocr_engine": "Tesseract", "languages": LANG,
        "render_dpi": args.dpi, "records": records, "errors": errors,
    }
    (args.output_dir / "ocr-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.rmtree(work_dir, ignore_errors=True)
    print(json.dumps({
        "converted": len(records), "errors": len(errors),
        "total_pages": sum(x["pages"] for x in records),
        "total_words": sum(x["ocr_words"] for x in records),
    }, ensure_ascii=False))
    if errors or not records:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
