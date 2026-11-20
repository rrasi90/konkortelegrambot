# Pass A — صریح‌محاسب (explicit derivation)

You are pass A of a two-pass independent key derivation for Iranian Master's
entrance exam (kode 1142, management) questions whose texts were OCR-extracted.

For EVERY question in the assigned batch files (see task prompt), derive the
correct option by the most direct defensible route:

- D1 (computation): solve the numeric problem from the data in the stem itself.
- D2 (definition): match the option to a standard definition/formula that
  EXISTS IN THIS REPOSITORY. You may only quote from files under `src/data/`
  (bookChapters*.ts, flashcards*.ts, referenceBooksRepo.ts, konkorData.ts),
  `content/learning-courses/*.json`, the registered book chapters under
  `content/markdown/books/*/chapters/*.md`, or the project-authored compendium
  `public/assets/konkor-100p-centralized-compendium.md` (definitions only: a
  citation containing «سؤال <number>» is rejected by the gate). No outside
  knowledge as a citation.
- R (recall): if the answer needs a historical/theoretical fact that cannot be
  derived from the stem and has no in-repo quote, set layer "R", answerOption
  null. NEVER guess.

Rules:
1. Read the batch JSON: `{ id, year, number, sectionId, stem, options[] }`.
   Options are 1-based (option 1 = first).
2. For numeric option sets, if your computed value is within 2% relative
   (or 5 percentage points if options are percents) of more than one option,
   the item is ambiguous → layer "R".
3. Output a JSON array to the assigned out-file, one record per question:
   `{ "id", "layer": "D1"|"D2"|"R", "answerOption": 1|2|3|4|null,
      "derivation": "استدلال فارسی گام‌به‌گام (حداقل ۴۰ نویسه؛ برای R: چرا استنتاج‌ناپذیر است)",
      "citation": "برای D2 دقیقاً همان رشته‌ای که در فایل مخزن وجود دارد (verbatim، بدون تغییر حرفی). برای D1 فرمول یا خالی.",
      "optionsRejected": { "1": "چرا غلط است", "2": "...", "4": "..." } }`
   optionsRejected covers EVERY option except answerOption. For layer R, all four.
4. Persian text in derivation/optionsRejected; Persian digits; نیم‌فاصله; no em dash.
5. The citation for D2 MUST be a verbatim substring of a repository file — it is
   machine-checked after normalization (whitespace/ZWNJ/Persian digits may differ,
   letters must not). Keep it under 120 chars, copy it exactly.
6. Write ONLY your assigned out-file(s). Do not modify anything else.
7. Do not skip questions. If the stem is truncated/corrupted, layer "R" with
   derivation explaining what is missing.
