#!/usr/bin/env python3
"""Render a source-evidence pack for Arshad Management 1405 (set 1142, booklet 319A)."""
from pathlib import Path
import argparse, hashlib, json, subprocess
import fitz
from PIL import Image, ImageDraw

SOURCE_URL = "https://www8.sanjesh.org/noet_tk/Handlers/DownloadHandler.ashx?A=1405_arsh_319A"

def render_pages(pdf: Path, out: Path, prefix: str, dpi: int, selected=None):
    out.mkdir(parents=True, exist_ok=True)
    paths=[]
    with fitz.open(pdf) as doc:
        indexes = selected if selected is not None else list(range(1, doc.page_count+1))
        for n in indexes:
            page=doc[n-1]
            pix=page.get_pixmap(matrix=fitz.Matrix(dpi/72,dpi/72), alpha=False)
            im=Image.frombytes("RGB",[pix.width,pix.height],pix.samples)
            dest=out/f"{prefix}-p{n:02d}.jpg"
            im.save(dest,"JPEG",quality=90,optimize=True)
            paths.append(dest)
        page_count=doc.page_count
    return paths, page_count

def contact(paths,out,cols=4,thumb_w=420):
    if not paths: return
    ims=[]
    for p in paths:
        im=Image.open(p).convert("RGB")
        h=int(im.height*thumb_w/im.width)
        im=im.resize((thumb_w,h))
        c=Image.new("RGB",(thumb_w,h+32),"white")
        c.paste(im,(0,32))
        ImageDraw.Draw(c).text((8,8),p.stem,fill="black")
        ims.append(c)
    cw=max(x.width for x in ims); ch=max(x.height for x in ims)
    rows=(len(ims)+cols-1)//cols
    sheet=Image.new("RGB",(cols*cw,rows*ch),"#ddd")
    for i,im in enumerate(ims): sheet.paste(im,((i%cols)*cw,(i//cols)*ch))
    sheet.save(out,quality=91)

def sha256(path):
    h=hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda:fh.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()

def ocr_image(path):
    if subprocess.run(["bash","-lc","command -v tesseract >/dev/null 2>&1"]).returncode:
        return ""
    results=[]
    for psm in ("6","11"):
        r=subprocess.run(["tesseract",str(path),"stdout","-l","fas+eng","--psm",psm],
                         capture_output=True,text=True,timeout=120)
        results.append(r.stdout)
    return max(results,key=len)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source-dir",type=Path,required=True)
    ap.add_argument("--out",type=Path,required=True)
    args=ap.parse_args()
    booklet=args.source_dir/"MA_1142_1405.pdf"
    key=args.source_dir/"MA_1142_1405_KEY_319A.pdf"
    if not booklet.exists(): raise SystemExit("MA_1142_1405.pdf missing")
    args.out.mkdir(parents=True,exist_ok=True)

    pages,page_count=render_pages(booklet,args.out/"booklet","arshad-1405",160)
    cover, _=render_pages(booklet,args.out/"cover-hi","arshad-1405-cover",300,[1,2,3])
    contact(pages,args.out/"booklet-contact-sheet.jpg",4,420)
    contact(cover,args.out/"cover-and-subjects-contact-sheet.jpg",1,900)

    hashes={booklet.name:sha256(booklet)}
    manifest={
      "source_commit":"3d8a7031ffcd6dba450115a1f7f901ce4087fade",
      "exam_level":"arshad",
      "exam_family_code":"1142",
      "booklet_control_code":"319A",
      "exam_year":1405,
      "question_count_on_cover":285,
      "duration_minutes_on_cover":150,
      "booklet_pages":page_count,
      "booklet_source_sha256":hashes[booklet.name],
      "official_key_url":SOURCE_URL,
      "official_key_status":"not_retrieved",
      "answer_key_may_be_used":False,
      "visual_cover_review":"confirmed from source page 1 at 300 DPI"
    }
    if key.exists():
        keypages,key_count=render_pages(key,args.out/"key","arshad-1405-official-key",350)
        contact(keypages,args.out/"key-contact-sheet.jpg",1,1200)
        text=ocr_image(keypages[0]) if keypages else ""
        (args.out/"official-key-ocr.txt").write_text(text,encoding="utf-8")
        (args.out/"official-key-native-text.txt").write_text(
            "\n\n".join(p.get_text("text") for p in fitz.open(key)),encoding="utf-8")
        hashes[key.name]=sha256(key)
        normalized=text.replace(" ","").replace("\n","")
        checks={
          "year_1405":("۱۴۰۵" in text or "1405" in text),
          "set_1142":("۱۱۴۲" in text or "1142" in text),
          "booklet_319A":("319A" in text or "۳۱۹A" in text or "۳۱۹آ" in text),
          "management_title":("مدیریت" in text)
        }
        matches=all(checks.values())
        manifest.update({
          "official_key_status":"cover_match_candidate" if matches else "manual_cover_review_required",
          "official_key_file":key.name,
          "official_key_sha256":hashes[key.name],
          "official_key_pages":key_count,
          "official_key_cover_ocr_checks":checks,
          "answer_key_may_be_used":False
        })
    else:
        (args.out/"official-key-not-retrieved.txt").write_text(
          "The exact Sanjesh download for set 1142 / booklet 319A could not be retrieved in this run. "
          "No key from another set or booklet is substituted.\n"+SOURCE_URL+"\n",encoding="utf-8")
    manifest["source_hashes"]=hashes
    (args.out/"render-manifest.json").write_text(
      json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(manifest,ensure_ascii=False,indent=2))

if __name__=="__main__": main()
