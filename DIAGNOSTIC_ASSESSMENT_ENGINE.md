# DIAGNOSTIC_ASSESSMENT_ENGINE

## Overview
First-entry assessment system that determines user's initial knowledge state without assuming 50% mastery.

## Core Principle
User must NOT enter with assumed 50% mastery. Instead, diagnostic test results shown as "initial estimate" until sufficient evidence collected.

## Diagnostic Test Design

### 1. Adaptive Test Structure
- **Exam combination-specific**: Questions selected based on user's chosen combination
- **Course coverage**: Covers all related courses for the selected combination
- **Cognitive level variety**: Mix of remember, understand, apply, analyze levels
- **Time-tracking**: Record response time for each question
- **Confidence tracking**: User rates confidence before answering (1-5 scale)

### 2. Features
| Feature | Description |
| ------- | ----------- |
| Combination-adaptive | Questions match user's exam combination |
| Full course coverage | All related lessons represented |
| Cognitive level mapping | Maps to concept-skill hierarchy |
| Time recording | Response time in milliseconds |
| Confidence rating | User self-rating 1-5 before answer |
| Unknown topic detection | Identifies topics user has never seen |
| Initial estimate display | Show as "preliminary estimate" until evidence threshold |

### 3. Initial Estimate Display Format
```
| درس       | وضعیت اولیه | اقدام                     |
| --------- | ----------- | ------------------------- |
| آمار      | ضعیف        | آموزش پایه                |
| استراتژی  | متوسط       | آموزش تکمیلی و تست تحلیلی |
| بازاریابی | خوب         | مرور و آزمون انتقال       |
| زبان      | ضعیف        | مسیر مستقل زبان           |
```

**Important**: These percentages must be displayed as "تخمین اولیه" (initial estimate) until sufficient evidence gathered.

### 4. Evidence Collection Criteria
- **Minimum questions**: 20 questions per major course
- **Evidence threshold**: Enough responses to calculate reliable estimates
- **Confidence accumulation**: Track confidence ratings over time
- **Time patterns**: Analyze response time trends

### 5. Output: Learning Map
Generated personalized learning map showing:
- Each course status (weak/unstable/learning/mastered)
- Recommended starting point for each
- Priority ordering based on exam coefficients and prerequisites
- Estimated study hours per course

## Adaptive Planner Integration

### Study Priority Algorithm
```
Study Priority = f(Exam Weight, Knowledge Gap, Forgetting Risk, Prerequisite Importance, Time Budget)
```

### Algorithm Components

| Component | Description | Formula Hint |
| --------- | ----------- | ------------ |
| **Exam Weight** | Importance per exam structure | From coefficient ratios |
| **Knowledge Gap** | Difference from mastery | From diagnostic results |
| **Forgetting Risk** | FSRS-based retention prediction | From memory score |
| **Prerequisite Importance** | Dependency strength | From knowledge graph edge weights |
| **Time Budget** | Available study time | User-configured daily limit |

### Policing Policy (from roadmap)
- Topic questions should NOT always appear consecutively
- But forced random mixing should also be avoided
- For users who haven't mastered base concept: focused, relatively concentrated exercises first
- After initial learning: mix similar concepts to strengthen distinction
- Supported by spacing effect and active retrieval research

### Daily Study Plan Generation
1. Calculate priority for each available topic
2. Select top-priority items respecting:
   - Daily time limit
   - No more than N consecutive same-topic questions
   - Prerequisite fulfillment check
3. Generate plan with:
   - Question recommendations
   - Time allocation per item
   - Review vs. new learning balance

## Review Scheduler Integration

### FSRS-Based Scheduling
- **Memory retention**: Probability of retaining information
- **Conceptual mastery**: How well concept understood
- **Application & transfer**: Can user apply in new situations
- **Exam performance**: Expected performance in exam conditions

### Review Triggers
- **Due review**: FSRS-scheduled review day
- **Knowledge gap reinforcement**: Wrong answer triggers targeted review
- **Prerequisite repair**: Missing prerequisite identified → schedule repair
- **Cross-course bridge**: Related concepts in other courses scheduled

### Review Card Generation
- **Interval days**: Based on FSRS calculation
- **Ease factor**: Adjusted based on performance
- **Repair flag**: Marked if user struggled
- **Sibling shock**: Sibling cards affected
- **Prerequisite repairs**: Related skills need attention

## English Learning Module

### Vocabulary Organization
| Skill | Features |
| ----- | -------- |
| **Vocabulary** | Academic and specialized words |
| **Grammar** | Context-based grammar |
| **Cloze Test** | Word insertion in text |
| **Reading** | Long text comprehension |
| **Inference** | Drawing conclusions |
| **Paraphrasing** | Text restatement |
| **Speed Reading** | Speed and accuracy measurement |

### Flashcard Design
- Vocabulary cards must combine:
  - Text-based exercise
  - Active retrieval practice
- Spaced repetition integration
- Difficulty progression

### Reading Comprehension
- Long text comprehension exercises
- Inference question types
- Paraphrasing tasks
- Speed measurement

### Speed Reading Metrics
- Words per minute
- Accuracy percentage
- Progress tracking over time

## Research Lab (for interview preparation)

### Research Analysis Components
| Component | Description |
| --------- | ----------- |
| **Article Analysis** | Analyze research articles |
| **Research Gap** | Identify research gaps |
| **Methodology** | Evaluate methodology |
| **Hypothesis** | Assess hypotheses |
| **Result Evaluation** | Check result validity |
| **Proposal Design** | Design research proposals |
| **Research Methods** | Practice quantitative/qualitative/mixed |

### Interview Simulator

#### Specialized Interview
- Subject-specific questions
- Deep conceptual understanding

#### Research Methodology Interview
- Research method questions
- Design and analysis

#### Thesis Defense Simulation
- Final defense practice
- Committee-style questioning

#### Research Experience Discussion
- Present research background
- Answer about methodology choices

#### Specialized Language Questions
- Technical terminology
- Field-specific concepts

#### Oral Presentation
- Presentation skills practice
- Q&A simulation

### Comparative Interview System
- **Based on previous answer**: Next question difficulty adapts
- **Example**: If user weak on "Grounded Theory vs Thematic Analysis":
  - First: Basic conceptual question
  - Then: Applied practical question
  - Adaptive: Follow-up based on response quality

**Note**: Interview readiness path must remain independent optional module, as weight and evaluation criteria vary across universities and disciplines.

## Learning Analytics Dashboard

### KPI Categories (from roadmap)

| Category | KPI |
| -------- | --- |
| **Content** | Percent syllabus coverage |
| **Question Bank** | Percent verified questions |
| **Education** | Pre-test to post-test improvement |
| **Memory** | 7-day and 30-day retention rates |
| **Transfer** | Performance on new questions |
| **Exam** | Performance in comprehensive exam |
| **System** | API error rate |
| **System** | P95 latency |
| **Reliability** | Availability |
| **Security** | Security incidents |
| **Product** | Study program completion rate |

**Important**: Total active users, number of tests taken, and consecutive days should NOT be used as primary educational effectiveness metrics.

### Dashboard Data Sources
- User skill states (`user_skill_states` table)
- Review events (`review_events` table)
- Exam sessions (`exam_sessions` table)
- Exam responses (`exam_responses` table)
- Content version tracking (`content_versions` table)

### Visualization Requirements
- Progress over time (weekly/monthly)
- Area-wise breakdown
- Comparison with expected benchmarks
- Exportable reports

## Phase 4 Acceptance Criteria

| Criterion | Requirement |
| --------- | ----------- |
| User can complete full cycle without manual admin intervention | Register → Choose combination → Diagnostic → Learning map → Daily plan → Adaptive review → Cumulative assessment → Full exam simulation → Readiness report |
| At least one complete path for one exam combination is operational and educationally validated | Before expanding to all combinations |
| Diagnostic shows initial estimates (not assumed 50%) | Until evidence threshold met |
| Priority algorithm respects exam coefficients and knowledge gaps | Algorithm verified |
| Security measures implemented per audit | All OWASP items addressed |
| English learning module standalone optional | Can be enabled/disabled |

---
*Diagnostic assessment engine designed per roadmap. Proceed to adaptive planner.*