# OFFICIAL_PHD_QUESTION_BANK

## Overview
Official PhD question bank extracted from available exam sources (1405 structure confirmed; 1406 structure pending official booklet publication).

## Data Structure
Each question follows the standardized schema defined in the roadmap:

### Question Format
```json
{
  "id": "phd-1405-xxxx",
  "examType": "official_phd",
  "examYear": 1405,
  "combinationCode": "verified-code",
  "bookletQuestionNumber": 12,
  "source": {
    "document": "official-booklet",
    "page": 8,
    "finalKeyVerified": true
  },
  "subjectId": "management",
  "topicId": "strategy.competitive-advantage",
  "skillIds": [
    "strategy.vrio",
    "strategy.resource-analysis"
  ],
  "questionType": "conceptual",
  "cognitiveLevel": "analyze",
  "difficulty": {
    "initial": "provisional",
    "empirical": null
  },
  "options": [],
  "correctOption": null,
  "optionAnalysis": [],
  "explanation": "",
  "referenceIds": [],
  "verificationStatus": "pending_review"
}
```

## Currently Available Questions
*(Note: These are placeholder entries; actual extraction from official booklets to be completed)*

| ID | Year | Subject | Topic | Skill IDs | Type | Status |
| -- | ---- | ------- | ----- | -------- | ---- | ----- |
| phd-1405-001 | 1405 | management | strategy.competitive-advantage | vrio, resource-analysis | conceptual | pending_review |
| phd-1405-002 | 1405 | management | strategy.vrio | vrio | conceptual | pending_review |
| phd-1405-003 | 1405 | management | resource-analysis | resource-analysis | analytical | pending_review |

## Extraction Pipeline

### Step 1: Source Collection
- Collect official exam booklets from Organization of Educational Measurement
- Target: 3 most recent years (1403, 1404, 1405)
- Format: PDF or scanned booklets

### Step 2: Question Extraction
- Parse each question including:
  - Question text
  - Options (A-E or 1-5)
  - Correct key
  - Explanation text
  - Subject classification
  - Topic classification
  - Skill assessment mapping

### Step 3: Key Verification
- Verify correctOption against official answer keys
- Validate subjectId/topicId mappings
- Check cognitiveLevel appropriateness
- Confirm difficulty ratings

### Step 4: Schema Validation
- Validate against `EXAM_SPECIFICATION_SCHEMA.json`
- Ensure all required fields present
- Check ID uniqueness

## Quality Standards

### Official Question Requirements
1. **Single Correct Answer**: Each question must have exactly one correct option (unless type specifies otherwise)
2. **Source Verification**: Key must match official answer key from the exam booklet
3. **Explanation Provided**: Every question must have a scientific explanation
4. **Option Analysis**: Each incorrect option must have a rationale for being incorrect
5. **Subject-Topic Mapping**: Question must map to valid subject/topic combination from exam structure

### Validation Rules
- `correctOption` must be within `0` to `options.length - 1`
- `options.length >= 2` (minimum 2 options)
- `cognitiveLevel` must be from validated set
- `questionType` must match subject/topic difficulty
- `verificationStatus` must be one of: `pending_review`, `verified`, `quarantined`

## Known Gaps
- 1406 official questions not yet available (booklet pending publication)
- Question bank currently has 3 placeholder entries
- Full extraction from PDF booklets requires manual effort or OCR pipeline
- Some older questions (pre-1400) may have different formats

## Next Steps
1. Begin official booklet extraction (target: 10-20 questions from 1405 booklet)
2. Establish OCR pipeline for scanned booklets
3. Implement automated schema validation
4. Begin authoring supplementary questions (Phase 2.2)

---
*This bank will be populated with officially verified questions before Phase 2 gate completion.*