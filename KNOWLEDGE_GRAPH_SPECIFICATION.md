# KNOWLEDGE_GRAPH_SPECIFICATION

## Overview
This document defines the knowledge graph structure for the Konkor Telegram Bot learning system, mapping exam specifications to learnable units.

## Graph Schema

### Node Types
| Node Label | Description | Properties |
| ---------- | ----------- | ---------- |
| `ExamSpecification` | Official exam specification | `year`, `setCode`, `verification` |
| `ExamCombination` | Specific exam combination | `code`, `title`, `experimentalGroup` |
| `Subject` | Course subject | `id`, `title`, `level`, `coefficient` |
| `Course` | Academic course | `title`, `code`, `track` |
| `Topic` | Specific topic within a course | `id`, `title`, `chapter` |
| `Concept` | Key concept within a topic | `id`, `title`, `skillIds` |
| `Skill` | Measurable skill | `id`, `title`, `dependencies`, `confusableWith` |
| `Prerequisite` | Prerequisite relationship | `sourceNodeId`, `targetNodeId`, `relationType`, `weight` |
| `LearningResource` | Book, article, or resource | `id`, `title`, `authors`, `publishYear`, `sha256` |
| `Question` | Exam question | `id`, `nodeId`, `examYear`, `text`, `options`, `correctOption`, `explanation`, `verificationStatus` |
| `QuestionSkillMapping` | Maps question to skills | `questionId`, `skillId`, `mappingType` |

### Edge Types (Relationships)
| Relationship | Direction | Description | Properties |
| ------------ | ----------- | ----------- | ---------- |
| `HAS_SUBJECT` | ExamCombination → Subject | Links exam combination to its subjects | `coefficient` |
| `TEACHES` | Course → Topic | Course contains topics | `chapterNumber` |
| `COVERS` | Topic → Concept | Topic includes concepts | `depthLevel` |
| `REQUIRES` | Concept → Skill | Skill is required to understand concept | `proficiencyThreshold` |
| `PREREQUISITE` | Skill → Skill | One skill depends on another | `weight` (0.2-0.6) |
| `REFERENCES` | Question → LearningResource | Question references a learning resource | `citationType` |
| `ASSESSES` | Question → Concept | Question assesses understanding of concept | `cognitiveLevel` |
| `BELONGS_TO` | Question → Subject | Question belongs to a subject | `examYear` |

### Data Flow

1. **Exam Specification → Exam Combination → Subject → Course → Topic → Concept → Skill**
2. **Question Bank → Maps to Concepts → Skills via QuestionSkillMapping**
3. **Learning Resources → Support Concepts → Skills**
4. **User Progress → Updates Skill State → Affects Recommendations**

### Validation Rules
- Each `ExamCombination` must have at least one `Subject` with valid `coefficient`
- Each `Skill` must have a valid path from at least one `ExamCombination` through the graph
- `Prerequisite` weights must be between 0.2 and 0.6 inclusive
- Each `Question` must have a valid `nodeId` path to an `ExamCombination`
- Knowledge graph must be traversable from any `ExamCombination` to at least one `Skill`

### Example Subgraph (Management 1406)
```
ExamCombination(code: "2162", title: "Management")
  └── HAS_SUBJECT → Subject(id: "strategy", title: "Management Strategy")
        └── TEACHES → Topic(id: "strategy.competitive-advantage", title: "Competitive Advantage")
              └── COVERS → Concept(id: "vrio", title: "VRIO Framework")
                    └── REQUIRES → Skill(id: "strategy.vrio", title: "VRIO Analysis")
                          └── PREREQUISITE → Skill(id: "strategy.analysis", title: "Resource Analysis")
                                weight: 0.4
```

### Integration Points
- **Exam Structure**: Refer to `EXAM_SPECIFICATION_1406.md` and `EXAM_SPECIFICATION_SCHEMA.json`
- **Curriculum Data**: Reference `MANAGEMENT_CURRICULUM_MASTER.csv`
- **Question Bank**: Reference `OFFICIAL_PHD_QUESTION_BANK` from Phase 2
- **Skill Models**: Reference `SkillModel` type from `packages/contracts/src/index.ts`