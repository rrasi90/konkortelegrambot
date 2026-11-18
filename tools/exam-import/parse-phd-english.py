# پارس دفترچه‌های زبان عمومی دکتری (۱۴۰۳/۱۴۰۴/۱۴۰۵) — خروجی JSON برای بازبینی انسانی
# هیچ کلیدی ساخته نمی‌شود؛ فقط متن رسمی سؤال و گزینه‌ها استخراج می‌شود.
import io
import json
import re
import sys
from pathlib import Path

Q_START = re.compile(r'^(\d{1,2})\s*[-–]\s+(\S.*)$')
OPT_INLINE = re.compile(r'(?:^|\s)1\)\s*(.+?)\s+2\)\s*(.+?)\s+3\)\s*(.+?)\s+4\)\s*(.+?)\s*$')
OPT_START = re.compile(r'^\s*1\)\s*(.*)$')
FOOTER = re.compile(r'^(Source page|صفحهٔ منبع|زبان انگلیسی|PASSAGE|PART [ABC]|Directions:|PASSAGE 2:?)')


def norm_digits(s: str) -> str:
    fa = '۰۱۲۳۴۵۶۷۸۹'
    return ''.join(str(fa.index(c)) if c in fa else c for c in s)


def parse_file(path: Path) -> dict:
    lines = io.open(path, encoding='utf-8').read().splitlines()
    blocks = {}          # qnum -> {'text': [...], 'extra': [...]}
    order = []
    cur = None
    key_section = False
    key_tokens = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if re.search(r'Answer key|پاسخ کلیدی|پاسخنامه', line):
            key_section = True
            continue
        if key_section:
            if re.search(r'FastZaban|تشریحی کامل|معرفی زبان|صفحهٔ منبع', line):
                key_section = False
                continue
            key_tokens.extend(norm_digits(line).split())
            continue
        m = Q_START.match(norm_digits(line))
        if m and 1 <= int(m.group(1)) <= 40:
            cur = int(m.group(1))
            if cur not in blocks:
                order.append(cur)
                blocks[cur] = {'text': [], 'extra': []}
            blocks[cur]['text'].append(m.group(2))
            continue
        if cur is None:
            continue
        if FOOTER.match(line):
            blocks[cur]['extra'].append(('context', line))
            continue
        blocks[cur]['text'].append(line)

    questions = []
    for num in order:
        b = blocks[num]
        joined = ' '.join(b['text'])
        body, key = split_options(joined)
        questions.append({'number': num, 'raw': joined[:120], 'text': body, 'options': key})

    # کلید ۱۴۰۴: توکن‌ها به‌صورت جفت‌های متناوب (پاسخ، شمارهٔ تست)
    keys = {}
    tokens = [t for t in key_tokens if re.fullmatch(r'[1-4][0-9]?', t)]
    if len(tokens) == 80:
        for i in range(0, 80, 2):
            val, num = int(tokens[i]), int(tokens[i + 1])
            if 1 <= num <= 40 and 1 <= val <= 4:
                keys[num] = val
    return {'file': path.name, 'questions': questions, 'official_key': keys}


def split_options(joined: str):
    """متن سؤال تا «1)» و چهار گزینه؛ برای گزینه‌های چندخطی هم کار می‌کند."""
    idx = joined.find('1)')
    if idx < 0:
        return joined, []
    head = joined[:idx].strip()
    rest = joined[idx:]
    m = re.match(r'1\)\s*(.+?)\s*2\)\s*(.+?)\s*3\)\s*(.+?)\s*4\)\s*(.+)$', rest, re.S)
    if not m:
        return head, ['?']
    return head, [g.strip() for g in m.groups()]


def main(indir: str, out: str) -> int:
    src = Path(indir)
    files = [
        'English_PhD_1403.txt',
        'English_PhD_1404_Full_Text.txt',
        'English_PhD_1405_OCR_Editable.txt',
    ]
    result = [parse_file(src / f) for f in files]
    Path(out).write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
    for r in result:
        n_ok = sum(1 for q in r['questions'] if len(q['options']) == 4)
        print(f"{r['file']}: {len(r['questions'])} questions, {n_ok} with 4 options, official_key={len(r['official_key'])}")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
