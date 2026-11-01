# CONTENT_DATA_DICTIONARY

This document defines the data dictionary for all content entities in the Konkor learning system.

## Core Entities

### ExamSpecification
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `id` | string | Stable identifier | `exam-spec-1406` |
| `year` | number | Exam year (Persian year) | `1406` |
| `setCode` | string | Exam set code | `2162` |
| `experimentalGroup` | string | Experimental group | `علوم humaines` |
| `organizer` | string | Exam organizer | `سازمان سنجش آموزش کشور` |
| `verificationStatus` | string | Verification status | `official_verified` |
| `coefficientRatios` | object | Coefficient structure | see below |
| `questionCounts` | object | Question counts per section | see below |
| `durationMinutes` | object | Exam duration in minutes | see below |
| `negativeMarkingRatio` | number | Ratio for negative marking | `0.333` |

#### coefficientRatios object:
| Field | Type | Description |
| ---- | ---- | ----------- |
| `specializationCoefficient` | number | Coefficient for specialized courses (4 or 5) |
| `languageCoefficient` | number | Coefficient for language section (always 1) |
| `aptitudeCoefficient` | number | Coefficient for aptitude test (1 or null) |

#### questionCounts object:
| Field | Type | Description |
| ---- | ---- | ----------- |
| `specializationMin` | number | Minimum specialized questions |
| `specializationMax` | number | Maximum specialized questions |
| `languageCount` | number | Number of language questions |

#### durationMinutes object:
| Field | Type | Description |
| ---- | ---- | ----------- |
| `specialization` | number | Specialized exam duration in minutes |
| `language` | number | Language exam duration in minutes |

### ExamCombination
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `id` | string | Stable identifier | `combo-2162-business` |
| `code` | string | Exam combination code | `2162` |
| `title` | string | Combination title | `مجموعه بازرگانی مدیریت` |
| `experimentalGroup` | string | Experimental group | `علوم انسانی` |
| `subjects` | array | Linked subjects | see Subject[] |
| `verification` | string | Verification status |

### Subject
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `id` | string | Stable identifier | `subject-stats` |
| `title` | string | Subject title in Persian | `آمار و کاربرد آن در مدیریت` |
| `level` | string | Educational level | `کارشناسی` | `کارشناسی ارشد` | `عمومی` |
| `coefficient` | number | Subject coefficient in exam | `1` |
| `topics` | array | Linked topics | see Topic[] |

### Topic
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `id` | string | Stable identifier | `topic-strategy.competitive-advantage` |
| `title` | string | Topic title in Persian | `مزیت رقابتی` |
| `chapter` | string | Associated chapter/folder | `management-strategic` |
| `concepts` | array | Linked concepts | see Concept[] |
| `skillIds` | array | Linked skill IDs | see Skill[] |

### Concept
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `id` | string | Stable identifier | `concept.vrio` |
| `title` | string | Concept title in Persian | `فریمورک VRIO` |
| `description` | string | Brief description | `Framework for analyzing resources` |
| `skillIds` | array | Linked skill IDs | see Skill[] |

### Skill
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `id` | string | Stable identifier (UUID) | `skill-strategy.vrio` |
| `title` | string | Skill title in Persian | `تحلیل VRIO` |
| `course` | string | Associated course | `مدیریت استراتژیک` |
| `chapter` | string | Associated chapter | `management-strategic` |
| `topic` | string | Associated topic | `مزیت رقابتی` |
| `dependencies` | array | Prerequisite skill IDs | see below |
| `confusableWith` | array | Similar skill IDs | see below |
| `assessmentMap` | object | Diagnostic/verification question IDs | see below |
| `difficultyEstimate` | number | 0-100 based on box player analysis |
| `estimatedStudyHours` | number | Estimated study hours (orthodox) |
| `status` | string | User skill status | see UserSkillStatus enum |
| `evidenceLevel` | string | Evidence level | `none` | `partial` | `complete` | `certified` |
| `sinceWhen` | string | ISO date when status changed | `2024-01-15` |

#### UserSkillStatus enum:
| Value | Description |
| ---- | ---- |
| `unseen` | Never encountered |
| `evidence_gathering` | Gathering evidence |
| `skill_gap` | Identified skill gap |
| `in_remediation` | In remediation process |
| `evidence_sufficient` | Sufficient evidence gathered |
| `proven_independent` | Proven independent mastery |
| `certified` | Certified mastery |

#### assessmentMap object:
| Field | Type | Description |
| ---- | ---- | ----------- |
| `diagnosticQuestionIds` | array | Question IDs for diagnostic assessment |
| `verificationQuestionIds` | array | Question IDs for verification |
| `proofQuestionIds` | array | Question IDs for proof/holdout |

### LearningResource
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `id` | string | Stable identifier | `resource-book-ahmadi` |
| `title` | string | Resource title | `اسم کتاب` |
| `authors` | string | Author(s) | `اسم نویسنده` |
| `publishYear` | number | Publication year | `1403` |
| `type` | string | Resource type | `book` | `article` | `chapter` |
| `doi` | string | DOI (for articles) | `10.1234/....` |
| `sha256` | string | Content hash | `^[a-f0-9]{64}$` |
| `sizeBytes` | number | File size in bytes | `1048576` |
| `categories` | array | Topic categories | see below |
| `language` | string | Language | `persian` | `english` |

#### Categories array items:
| Field | Type | Description |
| ---- | ---- | ----------- |
| `topicId` | string | Associated topic ID |
| `relevance` | number | Relevance score 0-1 |

### Question
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `id` | string | Logical ID (logical_path harvest شده) | `phd-1405-xxxx` |
| `examType` | string | Exam type | `official_phd` |
| `examYear` | number | Exam year | `1405` |
| `combinationCode` | string | Combination code | `verified-code` |
| `bookletQuestionNumber` | number | Question number in booklet | `12` |
| `source` | object | Source document info | see below |
| `subjectId` | string | Subject identifier | `management` |
| `topicId` | string | Topic identifier | `strategy.competitive-advantage` |
| `skillIds` | array | Skill IDs being assessed | see below |
| `questionType` | string | Question type | `conceptual` | `analytical` | `comparative` | `quantitative` | `application` | `transfer` | `diagnostic` |
| `cognitiveLevel` | string | Cognitive level | `remember` | `understand` | `apply` | `analyze` | `evaluate` | `create` |
| `difficulty` | object | Difficulty estimate | see below |
| `options` | array | Answer options | see below |
| `correctOption` | number | Index of correct option (0-based) | `0` |
| `optionAnalysis` | array | Analysis of each option | see below |
| `explanation` | string | Scientific explanation | `""` |
| `referenceIds` | array | Reference evidence IDs | see below |
| `verificationStatus` | string | Verification status | `pending_review` | `verified` | `quarantined` |

#### difficulty object:
| Field | Type | Description |
| ---- | ---- | ----------- |
| `initial` | string | Provisional difficulty | `provisional` |
| `empirical` | number | Empirical difficulty from stats | `null` |

#### options array items:
| Field | Type | Description |
| ---- | ---- | ----------- |
| `text` | string | Option text |
| `isCorrect` | boolean | Whether it's correct |

#### optionAnalysis array items:
| Field | Type | Description |
| ---- | ---- | ----------- |
| `optionIndex` | number | Option index |
| `rationale` | string | Rationale for correctness/incorrectness |

#### referenceIds array items:
| Type | Description |
| ---- | ----------- |
| Evidence IDs | `ev_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |

### QuestionSkillMapping
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `questionId` | string | Question ID | `phd-1405-xxxx` |
| `skillId` | string | Skill ID | `skill-strategy.vrio` |
| `mappingType` | string | Type of mapping | `assesses` | `references` |

### UserSkillState (current state per user)
| Field | Type | Description | Example |
| ---- | ---- | ----------- | ------- |
| `skillId` | string | Skill identifier | `skill-strategy.vrio` |
| `userId` | string | User identifier | `user-12345` |
| `masteryEstimate` | number | 0-100, tentative if low evidence | `72` |
| `masteryConfidence` | number | 0-1 based on evidence count and quality | `0.78` |
| `evidenceCount` | number | Validated responses count | `15` |
| `evidenceQuality` | number | Average confidence of evidence (0-1) | `0.85` |
| `memoryScore` | number | FSRS retention score (0-1) | `0.67` |
| `lastReviewedAt` | string | ISO timestamp | `2024-01-20T10:30:00Z` |
| `scheduledNextReview` | string | ISO timestamp | `2024-02-20T10:30:00Z` |
| `avgResponseTime` | number | Milliseconds (baseline per skill) | `1250` |
| `responseTimeStdDev` | number | Standard deviation | `280` |
| `fluencyStatus` | string | `slow` | `normal` | `fast` | `exceptional` |
| `dominantErrorType` | string | `'unknown'` or error type string | `concept_gap` |
| `errorHistory` | array | See below | see below |
| `coveredConcepts` | array | Concept IDs covered | see below |
| `uncoveredGaps` | array | Concept IDs with gaps | see below |
| `progressPercent` | number | 0-100, clearly labeled | `78` |

#### errorHistory array items:
| Field | Type | Description |
| ---- | ---- | ----------- |
| `type` | string | Error type |
| `count` | number | Count of occurrences |
| `lastAt` | string | ISO timestamp of last occurrence |
| `resolved` | boolean | Whether resolved |

#### coveredConcepts array items:
| Type | string | Concept ID |

#### uncoveredGaps array items:
| Type | string | Concept ID |

## Standard Naming Conventions

### ID Formats
- `ExamSpecification`: `exam-spec-{year}` (e.g., `exam-spec-1406`)
- `ExamCombination`: `combo-{setCode}-{subGroupId}` (e.g., `combo-2162-business`)
- `Subject`: `subject-{slug}` (e.g., `subject-stats`)
- `Topic`: `topic-{category}.{subCategory}` (e.g., `topic-strategy.competitive-advantage`)
- `Concept`: `concept-{name}` (e.g., `concept.vrio`)
- `Skill`: `skill-{category}.{name}` (e.g., `skill-strategy.vrio`)
- `LearningResource`: `resource-{type}-{identifier}` (e.g., `resource-book-ahmadi`)
- `Question`: `phd-{year}-{sequence}` (e.g., `phd-1405-xxxx`)
- `UserSkillState`: `user-{userId}-skill-{skillId}` (e.g., `user-12345-skill-skill-strategy.vrio`)

### Date/Time Formats
- All dates use ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`
- Persian/Gregorian conversion follows standard conventions
- Timestamps are always UTC unless otherwise noted

### File Naming Conventions
- Markdown files: `UPPER_SNAKE_CASE.md` or `lowercase-with-dashes.md`
- JSON schema files: `kebab-case.json` or `UPPER_SNAKE_CASE.json`
- CSV files: Lowercase with underscores, first row is header
- Excel files: `.xlsx` format with structured data
- Image assets: Descriptive names with `.png`/`.svg`/`.jpg` extensions

### Versioning
- All data entities should include a `version` field when applicable
- Schema versions tracked separately from data versions
- Breaking changes require schema version increment
- Backward compatibility maintained where possible

### Audit Trail
- Every data modification should record:
  - `changedBy`: User or system identifier
  - `changedAt`: ISO timestamp
  - `changeReason`: Description of why change was made
  - `affectedFields`: List of fields modified