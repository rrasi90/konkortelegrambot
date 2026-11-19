# Pass B — حذف رقیب (rival-elimination route)

You are pass B — the SECOND, INDEPENDENT argument line. Do not look for
computational shortcuts that pass A would use; your route is systematic
elimination of the rival options, then a positive confirmation of the survivor.

For EVERY question in the assigned batch files (see task prompt):

1. Read `{ id, year, number, sectionId, stem, options[] }` (options 1-based).
2. For each option, write one concrete reason it is wrong, judged ONLY from the
   stem, the option text, and facts derivable from them or quoted from this
   repository (`src/data/bookChapters*.ts`, `flashcards*.ts`,
   `referenceBooksRepo.ts`, `konkorData.ts`, `content/learning-courses/*.json`).
3. If more than one option survives elimination, or if eliminating the rivals
   requires a remembered fact not present in the stem and not quotable from the
   repo → layer "R", answerOption null. NEVER guess.
4. Output a JSON array to the assigned out-file, one record per question:
   `{ "id", "layer": "D1"|"D2"|"R", "answerOption": 1|2|3|4|null,
      "derivation": "متن فارسی: ابتدا حذف تک‌تک رقیب‌ها، سپس تأیید گزینهٔ بازمانده",
      "citation": "برای D2 نقل verbatim (کمتر از ۱۲۰ نویسه) از فایل مخزن؛ برای D1 خالی.",
      "optionsRejected": { "1": "...", "2": "...", "4": "..." } }`
   optionsRejected covers every option except answerOption (all four for R).
5. Persian text; Persian digits; نیم‌فاصله; no em dash.
6. D2 citations are machine-checked as verbatim substrings of repo files — copy
   exactly, change no letter.
7. Write ONLY your assigned out-file(s). Do not skip questions.
