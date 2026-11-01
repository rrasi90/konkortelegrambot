# ITEM ANALYSIS REPORT

## Overview
 psychometric analysis of question quality using Classical Test Theory and IRT models.

### 1. Classical Test Theory (CTT) Analysis

#### 1.1 Item Difficulty
| Index | Description | Formula |
| ----- | ----------- | ------- |
| **p-value** | Percentage of test-takers answering correctly | p = Number correct / Number attempted |

#### 1.2 Item Discrimination
| Index | Description | Formula |
| ----- | ----------- | ------- |
| **Point-Biserial** | Correlation between item score and total test score | r_pb = Σ(X_i - X̄)(T - T̄) / √(Σ(X_i - X̄)² Σ(T - T̄)²) |

#### 1.3 Distractor Analysis
- **Frequency**: How often each distractor is selected
- **Effectiveness**: Whether distractors function as plausible wrong answers
- **Modification**: Revise or replace poorly functioning distractors

#### 1.4 Test Reliability
- **Cronbach's α**: Internal consistency of the test
- **Formula**: α = (k / (k-1)) × (1 - Σσ²_i / σ²_total)
  - k = number of items
  - σ²_i = variance of item i
  - σ²_total = total test variance

#### 1.5 Standard Error of Measurement
- **SEM**: Estimated error in observed scores
- **Formula**: SEM = SD × √(1 - α)
  - SD = standard deviation of total scores
  - α = Cronbach's alpha

### 2. Item Response Theory (IRT) Analysis

#### 2.1 2PL Model Parameters
| Parameter | Description | Range |
| ----- | ----------- | ----- |
| **a (discrimination)** | How well item discriminates between ability levels | a > 0 |
| **b (difficulty)** | Item difficulty on ability scale | b ∈ ℝ |
| **c (guessing)** | Lower asymptote (typically 0 for MCQ) | 0 ≤ c < 1 |

#### 2.2 Model Fit
- **Item-fit statistics**: MNSQ (mean square) statistics
- **Outfit**: Outfit mean-square (residual-based)
- **Infit**: Infit mean-square (weighted by model)
- **Threshold**: 0.7-1.3 acceptable range (Rasch); wider for 2PL

#### 2.3 IRT Information Function
- **Test information**: ITT(θ) = ΣI_i(θ) where I_i(θ) = a_i² × P(θ) × Q(θ)
- **Standard error**: SEM(θ) = 1/√ITT(θ)

### 3. Analysis Report Structure

| Section | Content |
| ------- | -------- |
| **Test Information** | Test name, total items, sample size, administration conditions |
| **Difficulty Distribution** | Histogram of p-values, mean, SD, range |
| **Discrimination Distribution** | Histogram of point-biserial r, mean, SD, range |
| **Distractor Statistics** | For each item: frequency of each option, item-total correlations |
| **Reliability** | Cronbach's α, standard error of measurement |
| **Item Statistics Table** | For each item: p-value, point-biserial, distractor frequencies, MNSQ fit |
| **Flagged Items** | Items with: p < 0.2 or p > 0.9, |r_pb| < 0.2, MNSQ outside 0.5-1.5 |
| **Recommendations** | Item revision, replacement, or deletion suggestions |
| **IRT Analysis** | 2PL parameter estimates if sufficient sample size |

### 4. Sample Size Requirements

| Analysis Type | Minimum Sample | Recommended |
| ------------- | -------------- | ----------- |
| CTT basic | 30 responses | 100+ |
| CTT advanced | 100 responses | 300+ |
| IRT 2PL | 200 responses | 500+ |
| IRT 3PL | 500 responses | 1000+ |

### 5. Interpretation Guidelines

#### Difficulty
- p < 0.2: Too difficult (ceiling effect concern)
- 0.2 ≤ p ≤ 0.8: Acceptable range
- p > 0.9: Too easy (floor effect concern)

#### Discrimination
- |r_pb| < 0.2: Poor discrimination (item not differentiating)
- 0.2 ≤ |r_pb| ≤ 0.4: Acceptable
- |r_pb| > 0.4: Good discrimination

#### Fit
- MNSQ 0.5-1.3: Acceptable (Rasch model)
- MNSQ 0.7-1.5: Acceptable (2PL model)
- MNSQ < 0.5: Overfit (item too predictable)
- MNSQ > 1.5: Underfit (item behaves unpredictably)

### 6. Item Decision Rules

| Situation | Action |
| --------- | ----- |
| p < 0.2 & |r_pb| < 0.2 & MNSQ outside 0.5-1.5 | Delete item |
| p < 0.2 & |r_pb| ≥ 0.2 | Review distractor quality; consider revision |
| p > 0.9 & |r_pb| ≥ 0.2 | Consider if item serves purpose (may be screening item) |
| MNSQ < 0.5 & good discrimination | Review for overfitting; consider revision |
| MNSQ > 1.5 | Investigate; review item content and key |

### 7. Psychometric Analysis Workflow

1. **Data Collection**: Gather sufficient response data (minimum 100 per item)
2. **Preprocessing**: Clean data, handle missing values, code responses
3. **CTT Analysis**: Calculate p-values, point-biserial, Cronbach's α
4. **Flagging**: Identify items outside acceptable ranges
5. **IRT Analysis** (if sample sufficient): Estimate 2PL parameters
6. **Fit Evaluation**: Evaluate MNSQ fit statistics
7. **Distractor Analysis**: Review each distractor's performance
8. **Decision Making**: Revise, replace, or keep each item
9. **Report Generation**: Produce item analysis report
10. **Action Items**: Implement revisions for next version

### 8. Reporting Templates

#### Item Statistics Table Template
| Item ID | p-value | Point-Biserial | Distractor A % | Distractor B % | Distractor C % | Distractor D % | MNSQ Infit | MNSQ Outfit | Decision |
| ------- | ------- | -------------- | -------------- | -------------- | -------------- | -------------- | ---------- | ---------- | -------- |
| phd-1405-001 | 0.65 | 0.42 | 15% | 25% | 35% (KEY) | 25% | 1.05 | 1.02 | Keep |
| phd-1405-002 | 0.48 | 0.18 | 20% | 30% | 25% | 25% (KEY) | 1.45 | 1.48 | Review |

#### Flagged Items Summary
| Issue | Count | Items |
| ----- | ----- | ----- |
| p < 0.2 | N | Item IDs |
| p > 0.9 | N | Item IDs |
| |r_pb| < 0.2 | N | Item IDs |
| MNSQ outside 0.5-1.5 | N | Item IDs |
| Distractor with < 5% selection | N | Item IDs |

---
*Item analysis framework ready. Proceed to pilot test report.*