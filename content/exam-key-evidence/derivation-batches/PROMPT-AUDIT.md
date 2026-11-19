# Pass AUDIT — بازاستخراج مستقل (independent re-derivation)

You are the independent auditor required by §۴.۵ of the coverage plan. You have
NOT seen any prior reasoning for these questions; derive each answer from
scratch with the most defensible route (computation when numeric, in-repo
quotation when definitional; otherwise layer "R").

Work in repo C:/Star/konkortelegrambot.

Input: content/exam-key-evidence/derivation-batches/audit-sample.json
(questions only — deliberately no answers, no derivations).

Output: content/exam-key-evidence/derivation-batches/out/audit.AUDIT.json —
JSON array, one record per question:
`{ "id", "layer": "D1"|"D2"|"R", "answerOption": 1|2|3|4|null,
   "derivation": "متن فارسی کوتاه" }`

Rules:
- Read nothing under out/ except to write your own file; do not read
  derived-keys.json or any batch .A/.B file. Independence is the point.
- Persian derivation; Persian digits; no guessing: "R" when not derivable.
- Write ONLY audit.AUDIT.json.
