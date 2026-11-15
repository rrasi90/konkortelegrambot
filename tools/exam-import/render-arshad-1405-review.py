#!/usr/bin/env python3
"""Render private visual-audit artefacts for Master's Management 1405."""
from pathlib import Path
import argparse, json, fitz, hashlib, subprocess
from PIL import Image, ImageDraw

def render(pdf: Path, out: Path, prefix: str, dpi: int):
    out.mkdir(parents=True, exist_ok=True)
    paths=[]
    with fitz.open(pdf) as doc:
        for i,page in enumerate(doc,1):
            pix=page.get_pixmap(matrix=fitz.Matrix(dpi/72,dpi/72),alpha=False)
            im=Image.frombytes("RGB",[pix.width,pix.height],pix.samples)
            dest=out/f"{prefix}-p{i:02d}.jpg"
            im.save(dest,"JPEG",quality=88,optimize=True)
            paths.append(dest)
    return paths

def contact(paths,out,cols=4,thumb_w=420):
    ims=[]
    for p in paths:
        im=Image.open(p).convert("RGB")
        h=int(im.height*thumb_w/im.width)
        im=im.resize((thumb_w,h))
        c=Image.new("RGB",(thumb_w,h+32),"white"); c.paste(im,(0,32))
        ImageDraw.Draw(c).text((8,8),p.stem,fill="black"); ims.append(c)
    if not ims:return
    cw=max(x.width for x in ims); ch=max(x.height for x in ims)
    rows=(len(ims)+cols-1)//cols
    sheet=Image.new("RGB",(cols*cw,rows*ch),"#ddd")
    for i,im in enumerate(ims): sheet.paste(im,((i%cols)*cw,(i//cols)*ch))
    sheet.save(out,quality=90)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source-dir",type=Path,required=True)
    ap.add_argument("--out",type=Path,required=True)
    a=ap.parse_args()
    booklet=a.source_dir/"MA_1142_1405.pdf"
    key=a.source_dir/"MA_1142_1405_KEY.pdf"
    if not booklet.exists() or not key.exists(): raise SystemExit("Booklet or official key PDF missing")
    pages=render(booklet,a.out/"booklet","arshad-1405",160)
    cover=render(booklet,a.out/"cover-hi","arshad-1405-cover",300)[:3]
    keypages=render(key,a.out/"key","arshad-1405-official-key",350)
    contact(pages,a.out/"booklet-contact-sheet.jpg",4,420)
    contact(keypages,a.out/"key-contact-sheet.jpg",1,1200)
    with fitz.open(key) as pdf:
        native="\n\n".join(f"--- PDF page {i+1} ---\n"+p.get_text("text") for i,p in enumerate(pdf))
        key_count=pdf.page_count
    (a.out/"official-key-native-text.txt").write_text(native,encoding="utf-8")
    hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (booklet,key)}
    manifest={"source_commit":"3d8a7031ffcd6dba450115a1f7f901ce4087fade","booklet_pages":len(pages),"key_pages":key_count,"source_hashes":hashes,"booklet_render_dpi":160,"cover_render_dpi":300,"key_render_dpi":350}
    (a.out/"render-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(manifest,ensure_ascii=False))
if __name__=="__main__":main()
