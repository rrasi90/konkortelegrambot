# Mapping Contracts — AEL-003 (۵ خانوادهٔ اصلی)

## F1 — Legacy Course Packs (financial-management/statistics-foundations)
| فیلد مبدأ | فیلد مقصد | تبدیل | قرنطینه اگر |
|---|---|---|---|
| id | content_items.slug | `course-pack-` prefix | تکراری |
| topics[] | content_items(kind=course).body.topics | verbatim (raw حفظ) | — |
| questions[] | content_items(kind=mcq/essay).body | verbatim + courseId attach | بدون choices/prompt |
| review=pending_sme | content_versions.status=pending_review | **تبدیل به reviewed ممنوع (§37-16)** | — |
| sources[] | body.sources | verbatim | — |

## F2 — Official Question Banks (arshad 101 / phd 38 / quarantine 17)
| فیلد مبدأ | فیلد مقصد | تبدیل | قرنطینه اگر |
|---|---|---|---|
| id | questions(id) canonical | مستقیم | تکراری با محتوای متفاوت |
| examYear | question_appearances.year_label | verbatim (حدس تقویم ممنوع §7.1) | غایب → null Unknown |
| bookletCode/bookletQuestionNumber | appearances.booklet_code/number | verbatim | ناموجود → null (Unknown ≠ صفر) |
| correctOption | answer_claim (منبع=bank) | جدا از صورت | خارج از محدودهٔ گزینه‌ها |
| explanation | answer_explanation | جدا نگه‌داشتن (§4.6) | — |
| copyrightStatus | rights_status | pending→pending_review؛ unknown→unknown (Fail-closed §21) | — |

## F3 — Knowledge Graph
courses/syllabus-nodes/skills → knowledge_nodes/skills (مستقیم)؛ relations.jsonl → node_dependencies (قرنطینه: cycle)؛ question-skill-mappings.jsonl → question_skill_mappings (قرنطینه: مرجع ناموجود).

## F4 — Registry Seed (ael-p1-seed)
`processed` — قبلاً در 0019 مهاجرت شد (GATE_P1_PASS). provenance_class=synthetic → هرگز Published عمومی نمی‌شود (§6.3).

## F5 — Learning Evidence (۴ فایل)
`excluded_with_reason` برای Migration مستقیم — evidence مشتق‌شده است؛ مرجع ممیزی می‌ماند، رکورد محتوایی مستقل نیست (§6.4).

### قواعد سراسری (§7.1/§7.2)
Raw Value در Provenance Ledger حفظ می‌شود؛ Null ≠ empty ≠ 0 ≠ unknown؛ ترتیب گزینه‌ها دست نمی‌خورد؛ سال جلالی verbatim.
