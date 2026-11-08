# سطوح آمادگی UI (UI_READINESS_LEVELS) — V2-082 — PROPOSED

> PROPOSED — تا تأیید مالک در UI اعمال نمی‌شود.

## سطوح

| سطح | برچسب UI | شرط نمای اولیه |
|---|---|---|
| low | «اطمینان سنجش: پایین — شواهد کافی نیست» | readinessConfidence < 0.5 |
| medium | «اطمینان سنجش: متوسط — پوشش/ضرایب ناقص است» | 0.5 <= confidence < 0.8 |
| high | «اطمینان سنجش: بالا — پوشش و ضرایب کامل است (این رتبه یا تراز نیست)» | >= 0.8 |

این همان منطق confidenceLabel در exam-simulation.ts است (readinessConfidence >=0.8 high، >=0.5 medium).
