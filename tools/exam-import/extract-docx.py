# استخراج متن ساده از فایل‌های docx دکتری برای بررسی محتوا (بدون ادعای OCR)
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}


def docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml')
    root = ET.fromstring(xml)
    lines = []
    for para in root.iter('{%s}p' % NS['w']):
        runs = [t.text or '' for t in para.iter('{%s}t' % NS['w'])]
        text = ''.join(runs).strip()
        if text:
            lines.append(text)
    return '\n'.join(lines)


def main(src_dir: str, out_dir: str) -> int:
    src = Path(src_dir)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    files = sorted(src.glob('*.docx'))
    for f in files:
        text = docx_text(f)
        dest = out / (f.stem + '.txt')
        dest.write_text(text, encoding='utf-8')
        qcount = len(re.findall(r'^\s*(\d{1,3})[-–.\)]', text, flags=re.M))
        print(f'{f.name}: {len(text)} chars, {len(text.splitlines())} lines, ~{qcount} numbered lines')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
