#!/usr/bin/env python3
"""Integrity validator for review-only OCR staging data."""
import argparse,json,sys
from pathlib import Path

def rows(path):
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--data-dir",type=Path,required=True)
    args=ap.parse_args()
    d=args.data_dir
    docs=rows(d/"documents.jsonl")
    pages=rows(d/"raw-pages.jsonl")
    ar=rows(d/"appearances-1142.jsonl")
    phd=rows(d/"appearances-2162.jsonl")
    variants=rows(d/"appearances-variants.jsonl")
    quarantine=rows(d/"appearances-quarantine.jsonl")
    manifest=json.loads((d/"import-manifest.json").read_text(encoding="utf-8"))
    errors=[]
    if len(docs)!=22: errors.append("Expected 22 source DOCX records, got "+str(len(docs)))
    if len(pages)!=661: errors.append("Expected 661 raw OCR pages, got "+str(len(pages)))
    loc=[(x["sourceFile"],x["page"]) for x in pages]
    if len(set(loc))!=len(loc): errors.append("Duplicate source/page locator")
    ids=set()
    all_records=ar+phd+variants+quarantine
    for q in all_records:
        aid=q.get("appearanceId")
        if aid in ids: errors.append("Duplicate appearanceId "+str(aid))
        ids.add(aid)
        for field,expected in (("answerKey",None),("questionNumber",None),("allowedUse",[]),("verificationStatus","pending_sme"),("rightsStatus","unknown"),("rightsReviewStatus","pending_official_check"),("publicationStatus","staging_only")):
            if q.get(field)!=expected: errors.append("Gate failure "+str(aid)+" field "+field)
    for q in ar:
        if q["examRef"]["familyId"]!="msc-management-1142" or q["examRef"]["examSetCode"]!="1142": errors.append("Non-1142 source in 1142 primary file")
    for q in phd:
        if q["examRef"]["familyId"]!="phd-management-2162" or q["examRef"]["examSetCode"]!="2162": errors.append("Non-2162 source in 2162 primary file")
    c=manifest["counts"]
    checks={"documents":len(docs),"pages":len(pages),"primaryCandidates":len(ar)+len(phd),"variantCandidates":len(variants),"quarantinedCandidates":len(quarantine)}
    for k,v in checks.items():
        if c.get(k)!=v: errors.append("Manifest count mismatch "+k+": "+str(c.get(k))+" != "+str(v))
    if c.get("answerKeysImported")!=0 or c.get("chapterMappingsAssigned")!=0 or c.get("officiallyVerifiedQuestions")!=0 or c.get("productionServableCandidates")!=0:
        errors.append("A forbidden production-facing count is nonzero")
    if errors:
        print("\n".join(errors)); sys.exit(1)
    print(json.dumps({"valid":True,"documents":len(docs),"rawPages":len(pages),"primaryCandidates":len(ar)+len(phd),"variants":len(variants),"quarantineCandidates":len(quarantine),"answerKeysImported":0,"chapterMappingsAssigned":0,"productionServableCandidates":0},ensure_ascii=False))
if __name__=="__main__": main()
