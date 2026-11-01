# TARGET_ARCHITECTURE

## Overview
Convert the dual React + Telegram Mini App architecture into a unified system with shared logic, data, and motor (learning engine).

## Current Architecture Issues (from Roadmap)

| Issue | Current State | Problem |
| ----- | ------------ | ------- |
| **React Source of Content** | React application has independent content source | Data duplication |
| **Worker Independent Data** | Worker has independent lesson/data store | Inconsistent state |
| **Motor Discrepancy** | Learning motor packaged with React motor | Not shared |
| **Logic Split** | TypeScript in app, SQL in worker | Dual implementation |

## Target Architecture

```
Client Applications
├── Web Application
│   ← Shared API Layer
├── Telegram Mini App
│   ← Shared API Layer

API & Application Layer
├── Authentication
├── Exam Sessions
├── Content Delivery
└── User Progress

Learning Engine
├── FSRS · Mastery · Remediation

Assessment Engine
├── Question Bank · Exams · Scoring

Content Engine
├── Lessons · Books · Knowledge Graph

Planning Engine
├── Schedule · Priority · Analytics

Shared Contracts & Persistence
├── PostgreSQL
├── Versioned Content
├── User Evidence
└── Audit Logs
```

## 3.1 Packages Structure

```
packages/
├── contracts/           ← Data contracts & validation
├── content/            ← Scientific content & curriculum
├── learning-engine/    ← FSRS + Mastery logic
├── assessment-engine/  ← Exam generation & scoring
├── planning-engine/    ← Schedule & priority
└── utils/              ← Shared calculations
```

### packages/contracts
**Responsibility**: Model data contracts & shared validation  
**Key Types**: Exam specifications, question models, skill models, user states  
**Status**: ✅ Already exists with `index.ts` containing shared types

### packages/content
**Responsibility**: All scientific content management  
**Managed Data**:
- Exam Specifications
- Courses
- Topics
- Concepts
- Skills
- Lessons
- Questions
- Reference Books
- Knowledge Graph

**Key Principle**: React and Worker must NOT define educational data independently  
**Versioning**: Fixed content = versioned; Personal progress = database reference

### packages/learning-engine
**Responsibility**: Learning logic (FSRS, mastery, remediation)  
**Current**: `src/engine/aelEngine.ts` must be gradually replaced with shared motor  
**Migration**: First compare behavior on fixed scenarios; only then remove old motor

### packages/assessment-engine
**Responsibility**: Exam generation & scoring  
**Functions**: Question bank management, exam creation, scoring logic

### packages/planning-engine
**Responsibility**: Schedule & priority  
**Algorithm**: `Study Priority = f(Exam Weight, Knowledge Gap, Forgetting Risk, Prerequisite Importance, Time Budget)`

### packages/utils
**Responsibility**: Shared calculations  
**Functions**: Coefficient calculations, priority algorithms, date utilities

## 3.2 Shared Content Package

Create new package: `packages/content`

**All data managed from this package**:
- Exam Specifications
- Courses
- Topics
- Concepts
- Skills
- Lessons
- Questions
- Reference Books
- Knowledge Graph

**Rules**:
- React ↔ Worker data must originate from this package
- Fixed content → versioned files in repository
- Personal progress → PostgreSQL `user_skill_states` table

## 3.3 Learning Engine Migration

**Critical**: Transfer main logic to single reference source.

### Current State
- `src/engine/aelEngine.ts` - existing engine
- Logic split: TypeScript in app, SQL in worker

### Migration Plan
1. **Compare behaviors**: Run existing motor on fixed scenario set
2. **Identify differences**: Document all output discrepancies
3. **Build shared motor**: Create new shared implementation
4. **Gradual replacement**: Replace old motor in controlled steps
5. **Deprecate old**: Only after differences resolved

### Target State
- Single learning engine implementation
- Behavior parity confirmed across all scenarios
- Old motor removed after migration

## 3.4 Database Schema V2

### Core Tables (from roadmap)

| Table | Description |
| ---- | ----------- |
| `exam_specifications` | Exam structure |
| `exam_combinations` | Combinations & fields |
| `courses` | Lessons |
| `topics` | Topics |
| `concepts` | Concepts |
| `skills` | Skills |
| `question_bank` | Questions |
| `question_skill_mappings` | Question-skill links |
| `learning_resources` | Scientific resources |
| `user_skill_states` | User mastery state |
| `review_events` | Review history |
| `exam_sessions` | Exam sessions |
| `exam_responses` | Exam answers |
| `study_plans` | User study plans |
| `content_versions` | Content versions |
| `audit_logs` | Change history |

### Migration Plan Requirements
- ❌ Tables must NOT be replaced without review
- ✅ Migration Plan & data compatibility must be prepared first
- ✅ User progress must not be lost
- ✅ All migrations must be executable from scratch

### Security Hardening (from roadmap)

#### a) Attempt Ticket
- Ticket issuance on error must NOT be ignored in Production
- Requests without valid ticket must be rejected

#### b) Telegram Authentication
- `initData` validation MUST happen on server
- Telegram ID alone is NOT authentication proof

#### c) Device Token
- Current: `Math.random()` for device token in Mini App
- Required: `crypto.getRandomValues()`-based cryptographic RNG
- Token must be revocable & rotatable

#### d) Rate Limiting
- Current: Memory-only Worker limit insufficient
- Required: Infrastructure-level limit proportional to user identity

#### e) SQL Security
- `SECURITY DEFINER` functions must verify:
  - Execution permissions
  - `search_path` 
  - User ownership
  - Access to other users' resources

**Reference**: OWASP API Security Top 10  
**Particularly**: Broken Authentication, Broken Object Level Authorization, Unrestricted Resource Consumption

## 3.5 Skill Integration

### Current Problem
- `skillForNode` returns single skill: `Node → FirstSkill`
- SQL and TypeScript have different mastery update logic

### Required Change
- `Node → Skills[]` (return array)
- Mastery update must use single unified logic
- Calculate in Learning Engine; persist in database (not duplicate in both)

### Proposed Solution
- Mastery calculation in Learning Engine
- Database only stores atomic results
- No separate algorithms in SQL and TypeScript

## 3.6 CI/CD Pipeline (Proposed)

```
GitHub Actions
├── Type Check
├── Package Build
├── Content Validation
├── Unit Tests
├── Integration Tests
├── Database Migration Tests
├── Security Tests
├── E2E Tests
└── Build Artifacts
```

**Note**: No need for VPS or DB migration initially. Stabilize existing Cloudflare Workers + Supabase. Versioned content files in repo can be distribution source.

## 3.7 Gate 3 Acceptance Criteria

| Test | Criterion |
| ---- | --------- |
| Shared Content | Both interfaces have same content source |
| Engine Parity | Motor output identical in equivalent scenarios |
| Database Migration | All migrations runnable from start |
| Data Integrity | No user progress lost |
| Security | Inter-user access blocked |
| API Contracts | API responses match shared contract |
| Ticket Enforcement | No valid ticket → no response |
| Regression | Previous behaviors preserved |

---
*Target architecture defined per roadmap requirements. Proceed to Phase 4.*