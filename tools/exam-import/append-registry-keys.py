# افزودن کلیدهای سؤالات زبان دکتری به رجیستری سمت سرور (منبع حقیقت فعلی)
import io
import json
import sys

REG = 'apps/worker/src/data/client-bank-keys.server.ts'


def esc(t: str) -> str:
    return t.replace('\\', '\\\\').replace('"', '\\"')


def main() -> int:
    items = json.load(io.open('konkor/phd/extracted/phd-english-import.json', encoding='utf-8'))
    s = io.open(REG, encoding='utf-8').read()
    assert 'q.phd1403.9' not in s, 'keys already appended'
    rows = []
    for r in items:
        rows.append(
            '  { id: "q.phd%d.%d", bank: "yearlyKonkorExams", correctOption: %d, explanation: "%s", trapNote: "%s" },'
            % (r['year'], r['number'], r['key'] - 1, esc(r['explanation']), esc(r['trapNote']))
        )
    insert = '\n'.join(rows) + '\n'
    idx = s.rfind('];')
    assert idx > 0
    s = s[:idx] + insert + s[idx:]
    io.open(REG, 'w', encoding='utf-8', newline='\n').write(s)
    print('appended', len(rows), 'keys to registry')
    return 0


if __name__ == '__main__':
    sys.exit(main())
