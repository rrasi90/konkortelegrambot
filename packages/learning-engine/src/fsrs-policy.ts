// FSRS Policy - definitive schedule for review cards
// This policy governs which activity types are subject to FSRS scheduling

export const FSRS_POLICY = {
  // Activity types subject to FSRS scheduling
  subjectTypes: [
    'question_card',      // Regular question cards - YES
    'diagnostic_card',    // Diagnostic cards - YES (same schedule as questions)
    'verification_card',  // Verification attempts - YES
    'proof_card',         // Proof cards - NO (custom schedule)
    'remedial_card',      // Remediation cards - NO (custom schedule)
    'exam_card',          // Exam simulation cards - NO
  ],

  // NOT subject to FSRS - use traditional interval based on ease
  excludedTypes: [
    'remedial_card',
    'proof_card',
    'exam_card',
  ],

  // Default FSRS parameters (can be user-customized later via settings API)
  defaultParams: {
    once: 0.9,     // Initial ease factor
    forget: 0.8,   // Forgetting index
    frost: 1.2,    // Frost factor for memory decay
    good: 2.5,     // Easy rating (4 out of 5)
    hard: 1.3,     // Hard rating (3 out of 5)
    easy: 2.8,     // Too easy rating (5 out of 5)
  },

  // Policy: FSRS only schedules, doesn't influence mastery calculations directly
  masteryInfluence: false, // FSRS schedule ≠ mastery score change
  skillInfluence: true,    // Skill mastery uses separate model (UserSkillState)

  // Special rules
  rules: {
    // When a card is marked "Easy", increase ease more than normal
    easyBonus: 0.3,
    // When a card is marked "Hard", decrease ease less than normal
    hardPenalty: 0.2,
    // Minimum interval never below 1 day
    minInterval: 1,
    // Maximum interval cap (prevents cards from becoming permanent)
    maxInterval: 365, // 1 year
  },
};
