# تولید بلوک TypeScript سؤالات زبان دکتری و افزودن به انتهای YEARLY_KONKOR_QUESTIONS
# طبق جریان R-036: کلید/توضیح موقتاً در بانک کلاینت نوشته می‌شود، سپس
# generate-answer-key-registry → strip-client-bank-keys کلید را به سرور منتقل و از کلاینت حذف می‌کند.
import io
import json
import sys
from pathlib import Path

SRC = Path('src/data/yearlyKonkorExams.ts')
DATA = Path('konkor/phd/extracted/phd-english-import.json')

HEADER = {
    1403: 'دفترچهٔ زبان عمومی کنکور دکتری ۱۴۰۳ — سؤال‌های ۹ تا ۴۰ (۱ تا ۸ در OCR قابل بازیابی نیست)',
    1404: 'دفترچهٔ زبان عمومی کنکور دکتری ۱۴۰۴ — سؤال‌های ۱ تا ۴۰ (متن کامل دفترچه + کلید منتشرشده)',
    1405: 'دفترچهٔ زبان عمومی کنکور دکتری ۱۴۰۵ (کد 720A) — سؤال‌های ۱ تا ۴۰',
}
DESIGNED = 'گرامر جامع Fast Grammar، واژگان Fast Vocab و مهارت‌های Fast Reading (فست زبان) — عمومی'


def ts_str(s: str) -> str:
    """رشتهٔ TS تک‌خطی با backtick؛ نویسه‌های backtick و ${ باید نداشته باشند."""
    assert '`' not in s and '${' not in s
    return '`' + s.replace('\n', ' ') + '`'


def main() -> int:
    items = json.load(io.open(DATA, encoding='utf-8'))
    src = SRC.read_text(encoding='utf-8')

    blocks = []
    for year in (1403, 1404, 1405):
        rows = [r for r in items if r['year'] == year]
        if not rows:
            continue
        b = []
        b.append('  /* ------------------------------------------------------------------------')
        b.append(f'   * {HEADER[year]}')
        b.append('   * ------------------------------------------------------------------------ */')
        for r in rows:
            key = r['key'] - 1  # اندیس صفر-مبنا برای correctOption
            b.append('  {')
            b.append(f"    id: 'q.phd{r['year']}.{r['number']}',")
            b.append("    nodeId: 'bus.english_eshraghi',")
            b.append(f"    examYear: {r['year']},")
            b.append("    examLevel: 'دکتری',")
            b.append(f"    bookletQuestionNumber: {r['number']},")
            b.append("    courseSectionId: 'english',")
            b.append("    courseSectionTitle: 'زبان عمومی و تخصصی',")
            b.append(f"    designedFromTextbook: '{DESIGNED}',")
            b.append(f"    sourceReference: '{r['provenance']}',")
            b.append(f'    text: {ts_str(r["text"])},')
            opts = ', '.join(ts_str(o) for o in r['options'])
            b.append(f'    options: [{opts}],')
            b.append(f'    correctOption: {key},')
            b.append(f'    explanation: {ts_str(r["explanation"])},')
            if r['trapNote']:
                b.append(f'    trapNote: {ts_str(r["trapNote"])},')
            b.append(f"    expectedTimeMs: {60000 if r['hasPassage'] else 40000},")
            b.append('  },')
        blocks.append('\n'.join(b))
    block_text = '\n'.join(blocks) + '\n'

    # درج پیش از بسته‌شدن آرایهٔ YEARLY_KONKOR_QUESTIONS
    marker = "  /* ========================================================================\n   * سؤالات منتخب کنکور دکتری تخصصی مدیریت"
    assert marker in src, 'marker PhD block not found'
    src = src.replace(marker, block_text + '\n' + marker, 1)
    SRC.write_text(src, encoding='utf-8', newline='\n')
    print(f'appended {len(items)} questions to {SRC}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
