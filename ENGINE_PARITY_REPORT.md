# ENGINE_PARITY_REPORT

## Objective
Confirm output equivalence between existing `aelEngine.ts` and new shared learning engine across defined scenarios.

## Current State
- **Old Motor**: `src/engine/aelEngine.ts` (existing implementation)
- **Target**: Shared motor in `packages/learning-engine/` (to be built)
- **Status**: Comparison not yet performed

## Comparison Framework

### Scenario Matrix
| Scenario | Description | Old Motor Output | Target Output | Parity |
| -------- | ------------ | ---------------- | ------------- | ------ |
| S1 | Diagnostic assessment after first registration | ? | ? | ❓ |
| S2 | Skill mastery update after correct answer | ? | ? | ❓ |
| S3 | Skill mastery update after incorrect answer | ? | ? | ❓ |
| S4 | FSRS review scheduling | ? | ? | ❓ |
| S5 | Cross-course prerequisite repair | ? | ? | ❓ |
| S6 | Ticket-based exam session creation | ? | ? | ❓ |
| S7 | Exam session scoring | ? | ? | ❓ |

### Parity Metrics
- **Output JSON structure equivalence**: Same top-level keys
- **Numerical value tolerance**: Within 0.01 for probabilities, 1 for counts
- **Status string match**: Exact match for MasteryStatus, UserSkillStatus
- **Order independence**: Sets compared, not arrays (where order doesn't matter)

### Comparison Process

#### Step 1: Define Test Scenarios
Create deterministic input states for each scenario:
- Pre-configured user states
- Specific skill configurations
- Known exam combination codes
- Fixed question sets

#### Step 2: Run Old Motor
Execute `aelEngine.ts` with each scenario and capture full `EngineResult`:
- `report: RippleReport`
- `masteryUpdates: UserNodeMastery[]`
- `cardUpdates: ReviewCard[]`
- `createdCards: ReviewCard[]`
- `skillStateUpdate?: SkillStateUpdate`

#### Step 3: Build New Motor
Implement equivalent logic in shared package, producing identical output structure.

#### Step 4: Automated Comparison
Write validation script that:
1. Runs both motors on same inputs
2. Compares output structures
3. Reports discrepancies with diff
4. Marks pass/fail per scenario

#### Step 5: Threshold Definition
- **Pass**: All scenarios within tolerance
- **Fail**: Any scenario outside tolerance requires investigation
- **Partial**: Some scenarios pass, others fail → document gaps

## Migration Strategy

### Phase A: Comparison (Current)
1. Execute comparison framework
2. Document all discrepancies
3. Prioritize by impact and frequency

### Phase B: Shared Implementation
1. Build new motor in `packages/learning-engine/`
2. Match old motor behavior where possible
3. Document intentional differences (if any)

### Phase C: Gradual Replacement
1. **Run old motor in parallel** with new motor for N releases
2. **Compare outputs** on each release
3. **Fix discrepancies** before switching
4. **Switch default** to new motor when parity confirmed
5. **Deprecate old motor** after 2-3 stable releases

### Phase D: Deprecation
1. Remove old motor code
2. Update all imports to use new package
3. Update documentation
4. Clean up legacy code

## Engine Parity Acceptance Criteria

| Metric | Threshold |
| ------ | --------- |
| Scenario coverage | 100% of defined scenarios |
| Output structure match | 100% key equivalence |
| Numerical tolerance | ≤ 0.01 for probs, ≤ 1 for counts |
| Status string match | 100% exact match |
| Critical bugs | Zero blockers for switch |

## Next Steps
1. Define concrete test scenarios (minimum 20 scenarios covering all major code paths)
2. Execute old motor on scenarios and capture outputs
3. Begin shared motor implementation with parity as primary goal
4. Run comparison automation regularly during implementation

---
*Engine parity report prepared per roadmap requirements. Proceed to API contracts.*