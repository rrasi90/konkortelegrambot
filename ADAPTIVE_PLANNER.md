# ADAPTIVE_PLANNER

## Overview
Engine that generates personalized daily study plans based on exam structure, user knowledge state, and cognitive science principles.

## Core Algorithm
```
Study Priority = f(Exam Weight, Knowledge Gap, Forgetting Risk, Prerequisite Importance, Time Budget)
```

### Input Parameters

| Parameter | Source | Description |
| --------- | ------ | ----------- |
| **Exam Weight** | `exam_specifications` | Coefficient ratios from exam structure |
| **Knowledge Gap** | `user_skill_states` | Difference from mastery per skill |
| **Forgetting Risk** | FSRS memory scores | Retention probability |
| **Prerequisite Importance** | `knowledge_graph` | Edge weights (0.2-0.6) |
| **Time Budget** | User config | Daily available minutes |

### Priority Calculation Formula
```
Priority = (Exam Weight × Knowledge Gap × Prerequisite Multiplier) / (Forgetting Risk + ε)
```

Where:
- `Exam Weight`: Specialization coefficient × subject coefficient from exam structure
- `Knowledge Gap`: 100 - current mastery estimate (0-100 scale)
- `Prerequisite Multiplier`: 1.0 if all prerequisites met; 0.5 if any prerequisite gap; 0.2 if multiple gaps
- `Forgetting Risk`: 1 - FSRS memory retention score (0-1)
- `ε`: Small constant (0.01) to avoid division by zero

### Daily Plan Generation Process

#### Step 1: Collect Candidate Topics
From `user_skill_states` and knowledge graph:
- All skills where user has `< 100` mastery
- Prioritize skills with highest gap × weight product
- Filter by prerequisite fulfillment

#### Step 2: Score Each Candidate
Apply formula above for each candidate skill/topic.

#### Step 3: Apply Policing Rules (from roadmap)
- ❌ Do NOT display topic questions consecutively unlimited
- ❌ Do NOT force completely random mixing
- ✅ For users who haven't mastered base concept: focused, relatively concentrated exercises first
- ✅ After initial learning: mix similar concepts to strengthen distinction
- ✅ Support spacing effect and active retrieval research

#### Step 4: Select Daily Items
- Choose top-N items respecting:
  - Daily time limit (user-configured)
  - Maximum M consecutive same-topic questions
  - Prerequisite fulfillment
  - Mixing policy

#### Step 4: Generate Plan Output
```
Daily Study Plan:
1. Topic A: 20 min - Retrieval practice
2. Topic B: 15 min - Conceptual questions
3. Topic C: 10 min - Application exercise
4. Review: 5 min - FSRS due cards
```
### Policing Policy Detailed Rules

| Rule | Description | Implementation |
| ---- | ----------- | ------------- |
| **No consecutive unlimited** | Topic questions shouldn't always appear back-to-back | Track last 3 topics; if same topic 3x, force mix |
| **No mindless random** | Random mixing shouldn't be mindless | Weight by priority; random with probability |
| **Focused for beginners** | Users who haven't mastered base concept | Concentrated exercises on foundational topics first |
| **Mix after learning** | After initial learning: mix similar concepts | Similarity based on knowledge graph distance |
| **Spacing effect support** | Integrate spacing effect | Schedule reviews at increasing intervals |
| **Active retrieval support** | Support active retrieval | Include recall-based questions, not just recognition |

### Example Daily Plan Output

```
📅 Daily Study Plan (2026-11-01)
Total allocated: 45 min of 90 min available

1. 🔢 Statistics (آمار)
   - Focus: Central tendency measures
   - Type: Retrieval practice + 5 questions
   - Time: 15 min
   - Priority score: 87/100

2. 📊 Strategy (استراتژی)
   - Focus: VRIO framework analysis
   - Type: 3 conceptual questions + 1 application
   - Time: 20 min
   - Priority score: 73/100

3. ⏰ Review (مرور)
   - FSRS due cards: 3 cards
   - Type: Active recall
   - Time: 10 min
   - Priority score: N/A (scheduled)

💡 Notes:
- Avoid consecutive Statistics questions tomorrow
- VRIO concept mastery at 62% - consider targeted review
- Next statistics review scheduled in 3 days (FSRS)
```

### Time Budget Management
- User configures daily available minutes (e.g., 90 min)
- Plan automatically scales number of items
- If user exceeds time, mark items for later
- Track consecutive day streak for motivation (not as effectiveness metric)

### Prerequisite Enforcement
Before selecting a topic:
1. Check knowledge graph for prerequisite skills
2. Verify user has `proven_independent` or `certified` status on prerequisites
3. If prerequisites not met, show "Complete prerequisite first" message
4. Auto-schedule prerequisite repair in plan

### Integration with FSRS
- **Before new learning**: Check FSRS status of related memories
- **After incorrect answer**: Trigger repair review cycle
- **After correct answer**: Update FSRS parameters
- **Daily scheduling**: Include FSRS due cards in plan

### Integration with Exam Structure
- Read exam coefficients from `EXAM_SPECIFICATION_1406.md` data
- Weight topics by their contribution to exam score
- Prioritize high-coefficient topics near exam date
- Near exam: shift from learning to review mode

### Plan Validation
- Verify all selected topics have valid prerequisite paths
- Ensure no duplicate topic selection within plan
- Check time totals don't exceed user budget
- Confirm at least one item per selected exam combination

### Acceptance Criteria (Phase 4)
| Criterion | Requirement |
| --------- | ----------- |
| User completes full cycle without manual admin | Register → Combination → Diagnostic → Learning map → Daily plan → Adaptive review → Cumulative assessment → Full exam simulation → Readiness report |
| At least one complete path for one exam combination operational | Before expanding to all combinations |
| Priority algorithm respects exam coefficients and knowledge gaps | Algorithm verified |
| Security measures implemented per audit | All OWASP items addressed |

## Next Steps
1. Implement priority calculation function
2. Build daily plan generation endpoint
3. Integrate FSRS review scheduling
4. Add prerequisite enforcement
5. Create plan visualization
6. Test with real user data