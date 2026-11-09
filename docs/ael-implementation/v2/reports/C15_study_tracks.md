# C15 — مسیرهای مطالعه (V2-036)

- تاریخ: 2026-11-08 — مرجع: packages/contracts/src/index.ts TRACK_IDS

## TRACK_IDS (5 مسیر)

common, business, technology, strategy, industrial

## نگاشت زیرمجموعه به مسیر (SUB_GROUP_TRACK_SCOPES در exam-simulation.ts)

| زیرمجموعه | مسیرهای مجاز |
|---|---|
| business | business, common |
| public | common |
| industrial | industrial, common |
| media | technology, common |
| technology | technology, common |
| foresight | strategy, common |
| stpolicy | strategy, common |

## گره‌های syllabus در trackها

- common: 16 گره (mb/stats/islamic/sm)
- business: 5 گره (mkt.*)
- technology: 3 گره (inno/tech)
- strategy/industrial: 0 گره مستقیم؛ فقط scope شبیه‌ساز

## نکات

- strategy و industrial هیچ گره مستقیمی در syllabus-nodes ندارند؛ سؤال صنعتی (skill.ind.*) به node_id هایی مثل ind.or_simplex اشاره می‌کند که در nodes نیست — این ناهنجاری در GRAPH_missing_skills آمده است.
- activeTracks کاربر union مسیرها را می‌سازد؛ گره common همیشه مجاز است.
