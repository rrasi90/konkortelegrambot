/** پیاده‌سازی درون‌حافظه‌ای لایهٔ داده — برای تست و دمو */
import type { LearnerSkillState, ReviewCard, TrackId, UserNodeMastery } from '@ael/contracts';
import type { AnswerEvent, AppUser, DataStore, LearningAsset, LearnerDiagnosis, PlannerDecisionInput } from './store';

export class MemoryStore implements DataStore {
  users = new Map<string, AppUser>();
  private attempts = new Map<string, { userId: string; questionId: string; attemptId: string; expiresAt: number; usedAt?: number; issuedAt: number }>();
  private latestAttemptByQuestion = new Map<string, string>();
  private tgIndex = new Map<number, string>();
  nodes: import('@ael/contracts').KnowledgeNode[] = [];
  dependencies: import('@ael/contracts').NodeDependency[] = [];
  questions: import('@ael/contracts').Question[] = [];
  mastery = new Map<string, UserNodeMastery>(); // key: userId:nodeId
  cards = new Map<string, ReviewCard>();
  answers: AnswerEvent[] = [];
  plannerDecisions: Array<PlannerDecisionInput & { userId: string; planDate: string }> = [];
  learnerSkillStates = new Map<string, LearnerSkillState>();
  learningAssets: LearningAsset[] = [];
  learningEvidence: Array<{ userId: string; skillId: string; eventType: string; clientEventId: string; payload: Record<string, unknown> }> = [];
  private seq = 0;

  private attemptKey(userId: string, questionId: string): string {
    return userId + ':' + questionId;
  }

  async getUser(userId: string): Promise<AppUser | null> {
    return this.users.get(userId) ?? null;
  }

  async getUserByTelegramId(telegramUserId: number): Promise<AppUser | null> {
    const id = this.tgIndex.get(telegramUserId);
    return id ? (this.users.get(id) ?? null) : null;
  }

  async createUser(input: { telegramUserId?: number; displayName?: string }): Promise<AppUser> {
    const id = `user-${++this.seq}`;
    const user: AppUser = {
      id,
      telegramUserId: input.telegramUserId,
      displayName: input.displayName,
      activeTracks: ['common'],
      dailyCapacity: 30,
    };
    this.users.set(id, user);
    if (input.telegramUserId) this.tgIndex.set(input.telegramUserId, id);
    return user;
  }

  async setActiveTracks(userId: string, tracks: TrackId[]): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.activeTracks = tracks;
  }

  async setDailyCapacity(userId: string, dailyCapacity: number): Promise<void> {
    if (!Number.isInteger(dailyCapacity) || dailyCapacity < 10 || dailyCapacity > 480) {
      throw new Error('dailyCapacity must be an integer from 10 to 480 minutes');
    }
    const user = this.users.get(userId);
    if (user) user.dailyCapacity = dailyCapacity;
  }

  async logPlannerDecisions(userId: string, planDate: string, decisions: PlannerDecisionInput[]): Promise<void> {
    this.plannerDecisions.push(...decisions.map((decision) => ({ ...decision, userId, planDate })));
  }

  stats = new Map<string, import('./store').UserStats>();

  async getStats(userId: string): Promise<import('./store').UserStats | null> {
    return this.stats.get(userId) ?? null;
  }

  async upsertStats(stats: import('./store').UserStats): Promise<void> {
    this.stats.set(stats.userId, { ...stats });
  }

  async listAnswersSince(userId: string, sinceIso: string): Promise<AnswerEvent[]> {
    return this.answers.filter(
      (a) => a.userId === userId && new Date(a.answeredAt) >= new Date(sinceIso),
    );
  }

  async listNodes() {
    return this.nodes;
  }
  async listDependencies() {
    return this.dependencies;
  }
  async listQuestions() {
    return this.questions;
  }

  async listMastery(userId: string): Promise<UserNodeMastery[]> {
    const out: UserNodeMastery[] = [];
    for (const [key, row] of this.mastery) {
      if (key.startsWith(`${userId}:`)) out.push(row);
    }
    return out;
  }

  async upsertMastery(userId: string, rows: UserNodeMastery[]): Promise<void> {
    for (const r of rows) this.mastery.set(`${userId}:${r.nodeId}`, r);
  }

  private skillStateKey(userId: string, skillId: string): string {
    return `${userId}:${skillId}`;
  }

  async getLearnerSkillState(userId: string, skillId: string): Promise<LearnerSkillState | null> {
    return this.learnerSkillStates.get(this.skillStateKey(userId, skillId)) ?? null;
  }

  async recordLearningDiagnosis(userId: string, skillId: string, diagnosis: LearnerDiagnosis): Promise<LearnerSkillState> {
    const key = this.skillStateKey(userId, skillId);
    const repeated = this.learningEvidence.some(
      (event) => event.userId === userId && event.clientEventId === diagnosis.clientEventId,
    );
    if (repeated) return this.learnerSkillStates.get(key) ?? diagnosis.state;
    const node = this.nodes.find((item) => item.id === skillId);
    const user = this.users.get(userId);
    if (!node || !user || (node.track !== 'common' && !user.activeTracks.includes(node.track))) {
      throw new Error('Learner or active skill not found');
    }
    this.learnerSkillStates.set(key, diagnosis.state);
    this.learningEvidence.push({
      userId,
      skillId,
      clientEventId: diagnosis.clientEventId,
      eventType: diagnosis.errorType === 'slip' ? 'self_report_slip' : 'self_report_gap',
      payload: { ...diagnosis.reason, errorType: diagnosis.errorType, source: 'learner_self_report', notExpertVerified: true },
    });
    return diagnosis.state;
  }

  async recordLearningMilestone(
    userId: string,
    skillId: string,
    eventType: 'remediation_started' | 'remediation_completed',
    clientEventId: string,
    reason: Record<string, unknown>,
  ): Promise<void> {
    const repeated = this.learningEvidence.some(
      (event) => event.userId === userId && event.clientEventId === clientEventId,
    );
    if (repeated) return;
    const node = this.nodes.find((item) => item.id === skillId);
    const user = this.users.get(userId);
    if (!node || !user || (node.track !== 'common' && !user.activeTracks.includes(node.track))) {
      throw new Error('Learner or active skill not found');
    }
    this.learningEvidence.push({ userId, skillId, eventType, clientEventId, payload: reason });
    if (eventType === 'remediation_started') {
      const key = this.skillStateKey(userId, skillId);
      const old = this.learnerSkillStates.get(key);
      if (old && old.coverageState !== 'verified_by_unseen') {
        this.learnerSkillStates.set(key, { ...old, coverageState: 'remediating', updatedAt: new Date().toISOString() });
      }
    }
  }

  async listLearningAssets(skillId: string, assetType: LearningAsset['type']): Promise<LearningAsset[]> {
    return this.learningAssets
      .filter((asset) => asset.skillId === skillId && asset.type === assetType &&
        asset.verificationStatus === 'verified' && asset.rightsStatus !== 'blocked')
      .sort((a, b) => b.version - a.version)
      .map((asset) => ({ ...asset }));
  }

  async listCards(userId: string): Promise<ReviewCard[]> {
    return [...this.cards.values()].filter((c) => c.userId === userId);
  }

  async upsertCards(cards: ReviewCard[]): Promise<void> {
    for (const c of cards) this.cards.set(c.id, c);
  }

  async findAnswerByAttempt(userId: string, attemptId: string): Promise<AnswerEvent | null> {
    return this.answers.find((a) => a.userId === userId && a.attemptId === attemptId) ?? null;
  }

  async insertAnswerEvent(event: AnswerEvent): Promise<void> {
    this.answers.push(event);
  }

  async createQuestionAttempt(userId: string, questionId: string, attemptId: string, ttlSeconds = 900, _seenBefore = false, _itemVersion = '1'): Promise<string> {
    const now = Date.now();
    const key = this.attemptKey(userId, questionId);
    const previousId = this.latestAttemptByQuestion.get(key);
    const previous = previousId ? this.attempts.get(previousId) : undefined;
    if (previous && !previous.usedAt && previous.expiresAt > now) return previous.attemptId;
    const recent = [...this.attempts.values()].filter((a) => a.userId === userId && a.questionId === questionId && a.usedAt !== undefined && a.issuedAt > now - 3_600_000).length;
    if (recent >= 2) throw new Error('attempt issuance limit reached');
    this.attempts.set(attemptId, { userId, questionId, attemptId, issuedAt: now, expiresAt: now + ttlSeconds * 1000 });
    this.latestAttemptByQuestion.set(key, attemptId);
    return attemptId;
  }

  async commitAnswer(event: AnswerEvent, masteryRows: UserNodeMastery[], cards: ReviewCard[]) {
    const existing = await this.findAnswerByAttempt(event.userId, event.attemptId);
    if (existing) return { replay: true, report: existing.rippleReport };
    const attempt = this.attempts.get(event.attemptId);
    if (!attempt || attempt.userId !== event.userId || attempt.questionId !== event.questionId || attempt.usedAt || attempt.expiresAt <= Date.now()) {
      throw new Error('attempt missing, expired, or already used');
    }
    attempt.usedAt = Date.now();
    this.answers.push(event);
    if (event.learnerSkillState) {
      this.learnerSkillStates.set(this.skillStateKey(event.userId, event.learnerSkillState.skillId), event.learnerSkillState);
      const stateEventId = `answer:${event.attemptId}`;
      if (!this.learningEvidence.some((entry) => entry.userId === event.userId && entry.clientEventId === stateEventId)) {
        this.learningEvidence.push({
          userId: event.userId,
          skillId: event.learnerSkillState.skillId,
          clientEventId: stateEventId,
          eventType: 'learner_state_updated',
          payload: { state: event.learnerSkillState, wasCorrect: event.isCorrect, seenBefore: event.seenBefore ?? false },
        });
        if (event.learnerSkillState.coverageState === 'verified_by_unseen') {
          this.learningEvidence.push({
            userId: event.userId,
            skillId: event.learnerSkillState.skillId,
            clientEventId: `proof:${event.attemptId}`,
            eventType: 'unseen_verification',
            payload: { source: 'holdout_question', verified: true, attemptId: event.attemptId },
          });
        }
      }
    }
    for (const row of masteryRows) this.mastery.set(`${event.userId}:${row.nodeId}`, row);
    for (const card of cards) this.cards.set(card.id, card);

    const stats = this.stats.get(event.userId) ?? {
      userId: event.userId, coins: 0, streakDays: 0, lastStudyDate: null, dayNumber: 0, examDate: null,
    };
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(event.answeredAt));
    const yesterday = new Date(new Date(`${today}T00:00:00+03:30`).getTime() - 86_400_000);
    const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(yesterday);
    if (stats.lastStudyDate !== today) {
      stats.streakDays = stats.lastStudyDate === yesterdayStr ? stats.streakDays + 1 : 1;
      stats.dayNumber += 1;
      stats.lastStudyDate = today;
    }
    stats.coins += event.isCorrect ? 2 : 1;
    this.stats.set(event.userId, { ...stats });
    return { replay: false, stats: { ...stats } };
  }

}
