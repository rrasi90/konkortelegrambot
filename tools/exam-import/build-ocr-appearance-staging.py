#!/usr/bin/env python3
"""Build an auditable OCR staging corpus. Never writes to the live question bank."""
from __future__ import annotations
import argparse, hashlib, json, re, zipfile
from pathlib import Path
from collections import defaultdict
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
FA = "۰۱۲۳۴۵۶۷۸۹"; AR = "٠١٢٣٤٥٦٧٨٩"
DIGITS = str.maketrans(FA + AR, "0123456789" * 2)
BIDI = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]")
SPACE = re.compile(r"\s+")
PAGE_HEAD = re.compile(r"صفحه\s*([0-9۰-۹٠-٩]+)\s*از\s*([0-9۰-۹٠-٩]+)")
Q_PREFIX = re.compile(r"^\s*(?:[-–—]\s*)?([0-9]{1,3})\s*[-–—]\s*(?=\S)(.*)$")
Q_SOLO = re.compile(r"^\s*[-–—]\s*([0-9]{1,3})\s*[-–—]?\s*$")
OPTION_MARK = re.compile(r"(?<![\w(])([1-4])\s*[\)\]\}\[\(\{．\.،:;]")
OPTION_ATTACHED = re.compile(r"(?<=[A-Za-z\u0600-\u06FF])([1-4])\s*[\)\]\}]")
OPTION_BARE = re.compile(r"(?m)^\s*([1-4])\s+(?=\S)")

SOURCES = {
 "1142-1396.docx": dict(level="arshad",year=1396,set_code="1142",control_code="106C",status="eligible",evidence="OCR cover/subject table identifies management set 1142; control 106C.",source_pdf="1142-c-Arshad96-[www.konkur.in].pdf",retrieval="konkur.in archive"),
 "1142-1397.docx": dict(level="other",year=1397,set_code="1143",control_code="104E",status="quarantine",evidence="OCR cover identifies counseling, set 1143, not management set 1142.",source_pdf="MA_1142_1397.pdf",retrieval="dl.konkur.in"),
 "1142-1398.docx": dict(level="other",year=1398,set_code="1143",control_code="704A",status="quarantine",evidence="OCR cover identifies counseling, set 1143, not management set 1142.",source_pdf="MA_1142_1398.pdf",retrieval="dl.konkur.in"),
 "1142-1399.docx": dict(level="arshad",year=1399,set_code="1142",control_code="317",status="needs_cover_review",evidence="Management candidate; archive lists control 317 but cover/code match is not visually confirmed.",source_pdf="MA_1142_1399.pdf",retrieval="dl.konkur.in"),
 "1142-1400.docx": dict(level="arshad",year=1400,set_code="1142",control_code="717",status="needs_cover_review",evidence="Management candidate; archive lists control 717 but cover/code match is not visually confirmed.",source_pdf="MA_1142_1400.pdf",retrieval="dl.konkur.in"),
 "1142-1401.docx": dict(level="arshad",year=1401,set_code="1142",control_code="517A",status="eligible",evidence="OCR cover identifies management set 1142, control 517A.",source_pdf="MA_1142_1401.pdf",retrieval="dl.konkur.in"),
 "1142-1402.docx": dict(level="arshad",year=1402,set_code="1142",control_code="818C",status="eligible",evidence="OCR cover identifies management set 1142, control 818C.",source_pdf="MA_1142_1402.pdf",retrieval="dl.konkur.in"),
 "1142-1403.docx": dict(level="other",year=1403,set_code="1272",control_code="142A",status="quarantine",evidence="OCR cover identifies metallurgy/materials set 1272, not management 1142; archive code conflict remains unresolved.",source_pdf="MA_1142_1403.pdf",retrieval="dl.konkur.in"),
 "1142-1404.docx": dict(level="arshad",year=1404,set_code="1142",control_code="519C",status="eligible",evidence="OCR cover identifies management set 1142, control 519C.",source_pdf="MA_1142_1404.pdf",retrieval="dl.konkur.in"),
 "1142-1405.docx": dict(level="arshad",year=1405,set_code="1142",control_code="319A",status="eligible",evidence="OCR cover identifies management set 1142, control 319A.",source_pdf="MA_1142_1405.pdf",retrieval="dl.konkur.in"),
 "2162-1396.docx": dict(level="phd",year=1396,set_code="2162",control_code=None,status="eligible",evidence="OCR cover identifies doctoral management/business set 2162.",source_pdf="PhD_2162_1396.pdf",retrieval="phdtest.ir scan"),
 "2162-1397.docx": dict(level="other",year=1397,set_code="3163",control_code="126D",status="quarantine",evidence="OCR cover identifies management business/strategic set 3163, not 2162.",source_pdf="PhD_2162_1397.pdf",retrieval="phdtest.ir scan"),
 "2162-1398.docx": dict(level="other",year=1398,set_code="3162",control_code="5251",status="quarantine",evidence="OCR cover identifies management business/strategic set 3162, not 2162.",source_pdf="PhD_2162_1398.pdf",retrieval="phdtest.ir scan"),
 "2162-1399.docx": dict(level="other",year=1399,set_code="3162",control_code=None,status="quarantine",evidence="OCR cover identifies management business/strategic set 3162, not 2162.",source_pdf="PhD_2162_1399.pdf",retrieval="phdtest.ir scan"),
 "2162-1400.docx": dict(level="phd",year=1400,set_code="2162",control_code=None,status="eligible",evidence="OCR cover identifies management/business set 2162.",source_pdf="PhD_2162_1400.pdf",retrieval="phdtest.ir scan"),
 "2162-1401.docx": dict(level="phd",year=1401,set_code="2162",control_code=None,status="eligible",evidence="OCR cover identifies management/business set 2162; cover-year text partly noisy.",source_pdf="PhD_2162_1401.pdf",retrieval="phdtest.ir scan"),
 "2162-1402.docx": dict(level="phd",year=1403,set_code="2162",control_code="3258",status="year_conflict_variant",evidence="Filename says 1402 but OCR cover says doctoral exam 1403, set 2162, control 3258; keep separate from 1402.",source_pdf="PhD_2162_1402.pdf",retrieval="phdtest.ir scan"),
 "2162-1403.docx": dict(level="phd",year=1403,set_code="2162",control_code="620C",status="eligible",evidence="OCR cover identifies doctoral exam 1403, set 2162, control 620C.",source_pdf="PhD_2162_1403_620c.pdf",retrieval="official booklet-code scan/archive"),
 "2162-1404.docx": dict(level="phd",year=1404,set_code="2162",control_code="820A",status="needs_internal_code_review",evidence="OCR cover identifies 2162/820A but an interior header is OCR-read as 3162; hold for visual reconciliation.",source_pdf="PhD_2162_1404_official.pdf",retrieval="official-named scan"),
 "2162-1404-variant2.docx": dict(level="other",year=1404,set_code="3162",control_code="820A",status="quarantine",evidence="Alternate scan cover identifies set 3162, not target set 2162.",source_pdf="PhD_2162_1404.pdf",retrieval="phdtest.ir scan"),
 "2162-1405.docx": dict(level="phd",year=1405,set_code="2162",control_code="620A",status="eligible",evidence="OCR cover identifies management set 2162, control 620A.",source_pdf="PhD_2162_1405_official.pdf",retrieval="official-named scan"),
 "2162-1405-variant2.docx": dict(level="phd",year=1405,set_code="2162",control_code="620A",status="eligible_variant",evidence="Alternate scan appears to be set 2162/control 620A; retain separately pending image comparison.",source_pdf="PhD_2162_1405.pdf",retrieval="phdtest.ir scan"),
}

def norm(s): return str(s).translate(DIGITS)
def clean(s): return SPACE.sub(" ",BIDI.sub("",str(s)).replace("\x0c"," ").replace("\u00a0"," ")).strip()
def digest(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()
def read_docx_pages(path):
    with zipfile.ZipFile(path) as z: root=ET.fromstring(z.read("word/document.xml"))
    pages=[]; pageno=0; paras=[]
    for el in root.iter("{%s}p"%NS["w"]):
        s="".join(t.text or "" for t in el.iter("{%s}t"%NS["w"])).strip()
        if not s: continue
        m=PAGE_HEAD.search(s)
        if m:
            if pageno: pages.append({"page":pageno,"paragraphs":paras})
            pageno=int(norm(m.group(1))); paras=[]
        elif pageno:
            paras.append({"paragraph":len(paras)+1,"text":s})
    if pageno: pages.append({"page":pageno,"paragraphs":paras})
    return pages

def collect_option_markers(text):
    t=norm(text); found=[]
    for m in OPTION_MARK.finditer(t):
        found.append({"start":m.start(),"end":m.end(),"label":int(m.group(1)),"method":"punctuated"})
    for m in OPTION_ATTACHED.finditer(t):
        if not any(x["start"]==m.start(1) for x in found):
            found.append({"start":m.start(1),"end":m.end(),"label":int(m.group(1)),"method":"attached_after_word"})
    for m in OPTION_BARE.finditer(t):
        pos=m.start(1)
        if not any(x["start"]==pos for x in found):
            found.append({"start":pos,"end":m.end(1),"label":int(m.group(1)),"method":"line_start_bare"})
    found.sort(key=lambda x:x["start"]); dedup=[]
    for m in found:
        if dedup and m["start"]<dedup[-1]["end"]:
            if m["method"]=="punctuated": dedup[-1]=m
        else: dedup.append(m)
    return t,dedup

def parse_option_groups(text):
    t,marks=collect_option_markers(text)
    spans=[]; pos=0
    for part in t.split("\n"):
        spans.append((pos,pos+len(part))); pos+=len(part)+1
    def line_end(offset):
        for start,end in spans:
            if start<=offset<=end: return end
        return len(t)
    groups=[]; i=0
    while i<len(marks):
        if marks[i]["label"]!=1: i+=1; continue
        run=[marks[i]]; expected=2; j=i+1
        while j<len(marks):
            lab=marks[j]["label"]
            if lab==expected:
                run.append(marks[j]); expected+=1
                if expected==5: j+=1; break
            elif lab==1: break
            j+=1
        if len(run)>=2:
            span=(marks[j]["start"]-run[0]["start"]) if j<len(marks) else len(t)-run[0]["start"]
            if span<=1300:
                choices=[]
                for k,m in enumerate(run):
                    if k+1<len(run) and line_end(m["start"])>=run[k+1]["start"]:
                        end=run[k+1]["start"]
                    else: end=line_end(m["start"])
                    if k==len(run)-1 and j<len(marks) and marks[j]["label"]==1 and marks[j]["start"]<end:
                        end=marks[j]["start"]
                    choices.append(clean(t[m["end"]:end].strip(" \n\t|;,:")))
                groups.append({"start":run[0]["start"],"end":max(run[-1]["end"],line_end(run[-1]["start"])),"labels":[m["label"] for m in run],"choices":choices,"markerMethods":[m["method"] for m in run],"complete":len(run)==4 and [m["label"] for m in run]==[1,2,3,4]})
                i+=len(run); continue
        i+=1
    return t,groups

def find_question_starts(paras):
    starts=[]
    for i,p in enumerate(paras):
        t=clean(norm(p["text"])); m=Q_PREFIX.match(t)
        if m:
            n=int(m.group(1))
            if 1<=n<=320: starts.append({"para_index":i,"number":n})
            continue
        m=Q_SOLO.match(t)
        if m:
            n=int(m.group(1))
            if 1<=n<=320: starts.append({"para_index":i,"number":n})
    return starts

def explicit_internal_conflicts(pages,meta):
    joined="\n".join(p["text"] for pg in pages for p in pg["paragraphs"])
    conflicts=[]
    if meta.get("set_code") in ("1142","2162"):
        other="3162" if meta["set_code"]=="2162" else "1143"
        if re.search(r"(?:کد\s*|مدیریت\s*\(کد\s*)"+other,norm(joined)):
            conflicts.append("interior_header_mentions_other_exam_set_code_"+other)
    return conflicts

def normalized_hash(block,choices):
    def n(s): return SPACE.sub("",norm(s).lower().replace("ي","ی").replace("ك","ک"))
    return n(block)+"\n--\n"+"|".join(sorted(n(x) for x in choices))

def make_record(docx,meta,doc_hash,pdf_sha,page,block,seq,qnum,choices,labels,issues,pstart,pend):
    block=clean(block); issues=list(issues); flags=[]
    flags.append("question_number_candidate_needs_visual_confirmation" if qnum is not None else "question_number_unresolved")
    if not choices: issues.append("options_not_separated_by_ocr")
    elif labels != [1,2,3,4]: issues.append("options_incomplete_or_mislabeled")
    if any(len(x)>300 for x in choices): issues.append("option_text_long_possible_layout_or_following_question")
    if len(block)>1500 or re.search(r"PART\s*[ABC]|PASSAGE|Directions:|بخش\s*\d",block,re.I):
        issues.append("shared_passage_or_instructions_may_be_included")
    if not block and not choices: return None
    level=meta["level"]; h=doc_hash[:10]
    family="msc-management-1142" if level=="arshad" else "phd-management-2162"
    sourceid="src-ocr-"+level+"-"+str(meta["year"])+"-"+doc_hash[:12]
    app="app-ocr-"+level+"-"+str(meta["year"])+"-"+h+"-p"+str(page).zfill(3)+"-s"+str(seq).zfill(4)
    qid="qprov-"+level+"-"+str(meta["year"])+"-"+h+"-s"+str(seq).zfill(4)
    ch=hashlib.sha256(normalized_hash(block,choices).encode("utf-8")).hexdigest() if choices else None
    return {
      "appearanceId":app,"questionId":qid,"revisionId":qid+"#rev1",
      "examRef":{"familyId":family,"examLevel":"ارشد" if level=="arshad" else "دکتری","examYear":meta["year"],"examSetCode":meta["set_code"],"bookletControlCode":meta.get("control_code"),"documentVariant":docx.stem},
      "orderInExtractedSequence":seq,"questionNumber":None,"questionNumberCandidate":qnum,"questionNumberEvidence":"ocr_number_prefix_candidate" if qnum is not None else None,
      "sourceRef":{"sourceId":sourceid,"sourcePdf":meta["source_pdf"],"retrievalSource":meta.get("retrieval"),"ocrDocx":docx.name,"ocrDocxSha256":doc_hash,"sourcePdfSha256":pdf_sha,"locator":{"pdfPage":page,"paragraphStart":pstart,"paragraphEnd":pend}},
      "promptRaw":block,"choicesRaw":choices,"choiceLabelsDetected":labels,
      "answerKey":None,"answerKeyStatus":"not_imported_no_inference",
      "origin":"official_imported","trustLevel":"reported","verificationStatus":"pending_sme","rightsStatus":"unknown","rightsReviewStatus":"pending_official_check","allowedUse":[],
      "extractionStatus":"needs_review" if issues else ("complete_structure_unverified" if labels==[1,2,3,4] else "transcribed_unverified"),
      "ocrIssues":sorted(set(issues)),"reviewFlags":flags,"topicCandidates":[],"contentHash":ch,"deduplicationStatus":"not_compared","reviewStatus":"not_reviewed","publicationStatus":"staging_only"
    }

def process_page(docx,meta,dh,ph,page):
    paras=page["paragraphs"]; full="\n".join(p["text"] for p in paras); starts=find_question_starts(paras); segments=[]
    if len(starts)>=2:
        for j,s in enumerate(starts):
            a=s["para_index"]; b=starts[j+1]["para_index"] if j+1<len(starts) else len(paras)
            segments.append({"block":"\n".join(x["text"] for x in paras[a:b]),"number":s["number"],"pstart":a+1,"pend":max(a+1,b),"mode":"numbered"})
    else:
        text,groups=parse_option_groups(full); prev=0
        for g in groups:
            block=clean(text[prev:g["start"]]); prev=g["end"]; qn=None
            qm=Q_PREFIX.search(norm(block))
            if qm and 1<=int(qm.group(1))<=320: qn=int(qm.group(1))
            segments.append({"block":block,"number":qn,"pstart":1,"pend":max(1,len(paras)),"mode":"option","choices":g["choices"],"labels":g["labels"]})
    out=[]
    for i,s in enumerate(segments,1):
        block=s["block"]
        if s["mode"]=="numbered":
            t,groups=parse_option_groups(block); choices=[]; labels=[]; issues=[]
            if len(groups)==1: choices=groups[0]["choices"]; labels=groups[0]["labels"]
            elif len(groups)>1: issues.append("multiple_option_groups_in_one_question_block")
            rec=make_record(docx,meta,dh,ph,page["page"],block,i,s["number"],choices,labels,issues,s["pstart"],s["pend"])
        else:
            issues=[] if s["labels"]==[1,2,3,4] else ["option_labels_not_complete_1_to_4"]
            rec=make_record(docx,meta,dh,ph,page["page"],block,i,s["number"],s["choices"],s["labels"],issues,s["pstart"],s["pend"])
        if rec: out.append(rec)
    return out,full,starts

def write_jsonl(path,items):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text("".join(json.dumps(x,ensure_ascii=False)+"\n" for x in items),encoding="utf-8")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input-dir",type=Path,required=True)
    ap.add_argument("--output-dir",type=Path,required=True)
    args=ap.parse_args()
    output=args.output_dir; output.mkdir(parents=True,exist_ok=True)
    ocr=json.loads((args.input_dir/"ocr-manifest.json").read_text(encoding="utf-8"))
    pdf_hash={x["source_pdf"]:x.get("source_sha256") for x in ocr.get("records",[])}
    documents=[]; page_rows=[]; primary=[]; variants=[]; quarantined=[]; quarantine_docs=[]; variant_docs=[]; summaries=[]; hash_index=defaultdict(list)
    for docx in sorted(args.input_dir.rglob("*.docx")):
        meta=SOURCES.get(docx.name)
        if meta is None:
            quarantine_docs.append({"file":docx.name,"reason":"no_cover_audit_entry"})
            continue
        pages=read_docx_pages(docx); doc_hash=digest(docx)
        conflicts=explicit_internal_conflicts(pages,meta)
        hold=meta["status"] in ("quarantine","needs_cover_review","needs_internal_code_review") or bool(conflicts)
        is_variant=meta["status"] in ("year_conflict_variant","eligible_variant")
        docrec=dict(meta); docrec.update({"file":docx.name,"docxSha256":doc_hash,"pageCount":len(pages),"internalConflicts":conflicts,"sourcePdfSha256":pdf_hash.get(meta["source_pdf"])})
        documents.append(docrec)
        if hold: quarantine_docs.append(docrec)
        if is_variant: variant_docs.append(docrec)
        count=0; needs=0
        for page in pages:
            recs,full,starts=process_page(docx,meta,doc_hash,pdf_hash.get(meta["source_pdf"]),page)
            ids=[]
            for rec in recs:
                count+=1
                rec["orderInExtractedSequence"]=count
                rec["sourceAdmissionStatus"]="quarantined_source" if hold else ("variant_only" if is_variant else "primary_staging")
                ids.append(rec["appearanceId"])
                if hold: quarantined.append(rec)
                elif is_variant: variants.append(rec)
                else: primary.append(rec)
                if rec["extractionStatus"]=="needs_review": needs+=1
            page_rows.append({"sourceFile":docx.name,"sourcePdf":meta["source_pdf"],"sourcePdfSha256":pdf_hash.get(meta["source_pdf"]),"ocrDocxSha256":doc_hash,"examFamilyRequested":"msc-management-1142" if meta["level"]=="arshad" else "phd-management-2162","coverStatus":meta["status"],"sourceAdmissionStatus":"quarantined_source" if hold else ("variant_only" if is_variant else "primary_staging"),"page":page["page"],"paragraphCount":len(page["paragraphs"]),"questionNumberMarkers":[x["number"] for x in starts],"candidateAppearanceIds":ids,"fullOcrText":full,"reviewStatus":"not_reviewed"})
        summaries.append({"file":docx.name,"level":meta["level"],"coverYear":meta["year"],"coverSetCode":meta["set_code"],"status":"quarantined" if hold else ("variant_only" if is_variant else meta["status"]),"pages":len(pages),"candidateBlocks":count,"needsReview":needs})
    for rec in primary+variants:
        if rec.get("contentHash"): hash_index[rec["contentHash"]].append(rec["appearanceId"])
    duplicates=[{"contentHash":h,"appearanceIds":v,"status":"exact_hash_candidate_only_no_auto_merge"} for h,v in hash_index.items() if len(v)>1]
    write_jsonl(output/"documents.jsonl",documents)
    write_jsonl(output/"raw-pages.jsonl",page_rows)
    write_jsonl(output/"appearances-1142.jsonl",[x for x in primary if x["examRef"]["familyId"]=="msc-management-1142"])
    write_jsonl(output/"appearances-2162.jsonl",[x for x in primary if x["examRef"]["familyId"]=="phd-management-2162"])
    write_jsonl(output/"appearances-variants.jsonl",variants)
    write_jsonl(output/"appearances-quarantine.jsonl",quarantined)
    (output/"source-quarantine.json").write_text(json.dumps({"documents":quarantine_docs,"appearanceCandidates":len(quarantined)},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (output/"source-variants.json").write_text(json.dumps(variant_docs,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (output/"exact-duplicate-candidates.json").write_text(json.dumps(duplicates,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    allreview=primary+variants+quarantined
    counts={"documents":len(documents),"pages":len(page_rows),"primaryCandidates":len(primary),"arshadCandidates":sum(x["examRef"]["familyId"]=="msc-management-1142" for x in primary),"phdCandidates":sum(x["examRef"]["familyId"]=="phd-management-2162" for x in primary),"variantCandidates":len(variants),"quarantinedCandidates":len(quarantined),"completeFourOptionCandidates":sum(x["choiceLabelsDetected"]==[1,2,3,4] for x in allreview),"needsReview":sum(x["extractionStatus"]=="needs_review" for x in allreview),"quarantinedDocuments":len(quarantine_docs),"variantDocuments":len(variant_docs),"exactDuplicateCandidateGroups":len(duplicates),"answerKeysImported":0,"chapterMappingsAssigned":0,"officiallyVerifiedQuestions":0,"productionServableCandidates":0}
    manifest={"version":3,"generatedAt":"2026-11-15","purpose":"private staging only; not a production question bank","ocrSource":"Tesseract fas+eng DOCX at 250 DPI","policies":["All OCR page text from every DOCX is preserved in raw-pages.jsonl, including quarantined sources.","Question numbers remain null; OCR number readings are candidates only.","No answer key, answer index, explanation, or key inference is imported.","No chapter, skill, or topic mapping is assigned without separate evidence.","No automatic duplicate merge; exact hashes are candidate metadata only.","Rights status is unknown and pending official check; allowedUse is empty; nothing is production-servable.","Mismatched covers, unverified covers, internal-code conflicts, and alternate scans stay in separate quarantine/variant files."],"counts":counts,"sources":summaries}
    (output/"import-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    readme="\n".join([
      "# OCR exam-import staging corpus",
      "",
      "This is a private, review-only staging corpus, not the live question bank.",
      "documents.jsonl records all source DOCX metadata and cover audit evidence.",
      "raw-pages.jsonl preserves the full OCR transcript for every source page, including quarantined sources.",
      "appearances-1142.jsonl and appearances-2162.jsonl contain provisional candidates from admitted source documents.",
      "appearances-variants.jsonl keeps year-conflicted or alternate scans separate.",
      "appearances-quarantine.jsonl preserves candidate blocks from mismatched or unresolved sources.",
      "source-quarantine.json, source-variants.json and import-manifest.json record source status and audit counts.",
      "",
      "Every candidate has answerKey=null, questionNumber=null and allowedUse=[]. Trust is reported; verification is pending_sme; rights are unknown/pending_official_check; publicationStatus is staging_only.",
      "No answer, question number, chapter, skill, or official verification is inferred. No automatic duplicate merge is applied.",
      "Do not consume this folder from production quiz endpoints."
    ])+"\n"
    (output/"README.md").write_text(readme,encoding="utf-8")
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
if __name__=="__main__": main()
