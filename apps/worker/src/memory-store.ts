import { defaultSeed } from './default-seed';
/** پیاده‌سازی درون‌حافظه‌ای لایهٔ داده — برای تست و دمو */
import type { LearnerSkillState, ReviewCard, TrackId, UserNodeMastery } from '@ael/contracts';
import type { AttemptTicket, AnswerEvent, AppUser, AuditEventInput, DailyQueueItemRow, DataStore, ExamSelection, MasteryHistoryRow } from './store';

export class MemoryStore implements DataStore {
  users = new Map<string, AppUser>();
  private tgIndex = new Map<number, string>();
  private usernameIndex = new Map<string, string>();
  nodes: import('@ael/contracts').KnowledgeNode[] = [];
  dependencies: import('@ael/contracts').NodeDependency[] = [];
  questions: import('@ael/contracts').Question[] = [];
  mastery = new Map<string, UserNodeMastery>(); // key: userId:nodeId
  cards = new Map<string, ReviewCard>();
  answers: AnswerEvent[] = [];
  // R-020 جداول دامنه (حافظه‌ای) — mastery_history شبیه‌سازی trigger در upsertMastery
  masteryHistory: {
    userId: string; nodeId: string; previousScore: number | null; newScore: number;
    changeReason: string; recordedAt: string;
  }[] = [];
  examSelections = new Map<string, ExamSelection>(); // key: userId:examYear
  auditLog: (AuditEventInput & { recordedAt: string })[] = [];
  queueItems: (DailyQueueItemRow & { userId: string; queueDate: string; status: string })[] = [];
  private seq = 0;

  constructor(initialData?: {
    nodes?: import('@ael/contracts').KnowledgeNode[];
    dependencies?: import('@ael/contracts').NodeDependency[];
    questions?: import('@ael/contracts').Question[];
  }) {
    if (initialData?.nodes) this.nodes = initialData.nodes;
    else if (defaultSeed?.nodes) this.nodes = (defaultSeed.nodes as unknown as any[]).map((n) => ({ ...n }));

    if (initialData?.dependencies) this.dependencies = initialData.dependencies;
    else if (defaultSeed?.dependencies) this.dependencies = (defaultSeed.dependencies as unknown as any[]).map((d) => ({ ...d }));

    if (initialData?.questions) this.questions = initialData.questions;
    else if (defaultSeed?.questions) {
      // بستهٔ نمایشی: محتوای ساختگیِ مسیر دکتری — برچسب مبدأ صریح ثبت می‌شود
      // تا جلسهٔ شبیه‌سازی هرگز آن را «سؤال دفترچهٔ رسمی» معرفی نکند.
      const packMeta = (defaultSeed as unknown as { meta?: { synthetic?: boolean } }).meta ?? {};
      const contentOrigin = packMeta.synthetic ? 'synthetic_demo' : 'textbook_designed';
      this.questions = (defaultSeed.questions as unknown as any[]).map((q) => ({
        ...q,
        examLevel: q.examLevel ?? 'doctorate',
        contentOrigin: q.contentOrigin ?? contentOrigin,
      }));
    }
  }

  async getUser(userId: string): Promise<AppUser | null> {
    return this.users.get(userId) ?? null;
  }

  async getUserByTelegramId(telegramUserId: number): Promise<AppUser | null> {
    const id = this.tgIndex.get(telegramUserId);
    return id ? (this.users.get(id) ?? null) : null;
  }

  async getUserByTelegramUsername(username: string): Promise<AppUser | null> {
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    const id = this.usernameIndex.get(clean);
    return id ? (this.users.get(id) ?? null) : null;
  }

  async createUser(input: { telegramUserId?: number; telegramUsername?: string; displayName?: string }): Promise<AppUser> {
    const id = `user-${++this.seq}`;
    const cleanUser = input.telegramUsername ? input.telegramUsername.replace(/^@/, '').trim() : undefined;
    const user: AppUser = {
      id,
      telegramUserId: input.telegramUserId,
      telegramUsername: cleanUser,
      displayName: input.displayName || (cleanUser ? `@${cleanUser}` : 'داوطلب دکتری'),
      activeTracks: ['common'],
    };
    this.users.set(id, user);
    if (input.telegramUserId) this.tgIndex.set(input.telegramUserId, id);
    if (cleanUser) this.usernameIndex.set(cleanUser.toLowerCase(), id);

    // تضمین خالی بودن کامل پروفایل جدید در هنگام ثبت‌نام
    this.stats.set(id, {
      userId: id,
      coins: 0,
      streakDays: 0,
      lastStudyDate: null,
      dayNumber: 0,
      examDate: null,
      streakFreezeUsed: 0,
      streakFreezeMonth: null,
    });
    return user;
  }

  async setActiveTracks(userId: string, tracks: TrackId[]): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.activeTracks = tracks;
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
    for (const r of rows) {
      const prev = this.mastery.get(`${userId}:${r.nodeId}`);
      if (!prev || prev.mastery !== r.mastery || prev.status !== r.status) {
        this.masteryHistory.push({
          userId,
          nodeId: r.nodeId,
          previousScore: prev?.mastery ?? null,
          newScore: r.mastery,
          changeReason: prev ? 'answer_submit' : 'backfill',
          recordedAt: new Date().toISOString(),
        });
      }
      this.mastery.set(`${userId}:${r.nodeId}`, r);
    }
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
  async submitAnswerAtomic(input: {
    userId: string;
    questionId: string;
    selectedOption: number;
    attemptId: string;
    wasCorrect: boolean;
    rippleReport: unknown;
    masteryUpdates: UserNodeMastery[];
    cardUpserts: ReviewCard[];
    cardInserts: ReviewCard[];
  }): Promise<{ correctOption?: number; replay?: boolean } | null> {
    // همان اعتبارسنجی‌های RPC امن مهاجرت 0010: بلیت تک‌مصرفی، مالکیت، انقضا، کلید سمت سرور
    const ticket = this.tickets.get(input.attemptId);
    if (!ticket) throw new Error('Attempt ticket not found');
    if (ticket.userId !== input.userId) throw new Error('Attempt ticket belongs to another user');
    if (ticket.questionId !== input.questionId) throw new Error('Attempt ticket question mismatch');
    if (ticket.consumedAt) throw new Error('Attempt ticket already consumed');
    if (ticket.expiresAt <= Date.now()) throw new Error('Attempt ticket expired');

    const question = this.questions.find((candidate) => candidate.id === input.questionId);
    if (!question) throw new Error('Question not found');
    if (
      !Number.isInteger(input.selectedOption) ||
      input.selectedOption < 0 ||
      input.selectedOption >= question.options.length
    ) {
      throw new Error('Selected option is out of range');
    }

    ticket.consumedAt = new Date().toISOString();
    const wasCorrect = input.selectedOption === question.correctOption;
    await this.insertAnswerEvent({
      id: crypto.randomUUID(),
      userId: input.userId,
      questionId: input.questionId,
      selectedOption: input.selectedOption,
      isCorrect: wasCorrect,
      attemptId: input.attemptId,
      answeredAt: new Date().toISOString(),
      rippleReport: input.rippleReport,
    });
    await this.upsertMastery(input.userId, input.masteryUpdates);
    await this.upsertCards([...input.cardUpserts, ...input.cardInserts]);
    return { correctOption: question.correctOption, replay: false };
  }

  async issueAttemptTickets(
    userId: string,
    tickets: { attemptId: string; questionId: string; attemptType: string; itemVersion?: string }[],
  ): Promise<void> {
    for (const t of tickets) {
      if (this.tickets.has(t.attemptId)) throw new Error('Attempt ticket already exists');
      this.tickets.set(t.attemptId, {
        userId,
        questionId: t.questionId,
        attemptType: t.attemptType,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        consumedAt: null,
      });
    }
  }

  async getAttemptTicket(userId: string, attemptId: string, questionId: string): Promise<AttemptTicket | null> {
    const ticket = this.tickets.get(attemptId);
    if (!ticket || ticket.userId !== userId || ticket.questionId !== questionId) return null;
    return {
      attemptId,
      userId: ticket.userId,
      questionId: ticket.questionId,
      attemptType: ticket.attemptType as AttemptTicket['attemptType'],
      consumedAt: ticket.consumedAt ?? null,
      expiresAt: new Date(ticket.expiresAt).toISOString(),
    };
  }

  tickets = new Map<string, { userId: string; questionId: string; attemptType: string; expiresAt: number; consumedAt: string | null }>();

  skillStates = new Map<string, LearnerSkillState & { userId: string }>(); // key: userId:skillId

  async getSkillStates(userId: string): Promise<LearnerSkillState[]> {
    const out: LearnerSkillState[] = [];
    for (const [key, row] of this.skillStates) {
      if (key.startsWith(`${userId}:`)) out.push(row);
    }
    return out;
  }

  async upsertSkillState(
    userId: string,
    update: { skillId: string; nodeId: string; state: LearnerSkillState },
  ): Promise<void> {
    this.skillStates.set(`${userId}:${update.skillId}`, { ...update.state, userId });
  }

  async listPacks(): Promise<{ packId: string; title: string; tracks: TrackId[]; isDemo: boolean }[]> {
    const meta = (defaultSeed as unknown as { meta?: { packId?: string; title?: string; isDemo?: boolean } }).meta ?? {};
    return [
      {
        packId: meta.packId ?? 'demo-pack-phd-management',
        title: meta.title ?? 'بستهٔ نمایشی دکتری مدیریت',
        tracks: ['common', 'business', 'technology', 'strategy'],
        isDemo: meta.isDemo ?? true,
      },
    ];
  }

  /* ---------- R-020 — دامنهٔ جداول (in-memory) ---------- */

  async saveExamSelection(userId: string, input: {
    examYear: number;
    subGroupId: string;
    combinationCode?: string | null;
    setCode?: string | null;
  }): Promise<ExamSelection> {
    const selection: ExamSelection = {
      examYear: input.examYear,
      subGroupId: input.subGroupId,
      combinationCode: input.combinationCode ?? null,
      setCode: input.setCode ?? null,
      selectedAt: new Date().toISOString(),
    };
    // فقط یک انتخاب فعال به ازای سال (معادل constraint یکتا در SQL)
    this.examSelections.set(`${userId}:${input.examYear}`, selection);
    return selection;
  }

  async getActiveExamSelection(userId: string): Promise<ExamSelection | null> {
    let latest: ExamSelection | null = null;
    for (const [key, sel] of this.examSelections) {
      if (key.startsWith(`${userId}:`) && (!latest || sel.selectedAt > latest.selectedAt)) latest = sel;
    }
    return latest;
  }

  async logAudit(event: AuditEventInput): Promise<void> {
    this.auditLog.push({ ...event, recordedAt: new Date().toISOString() });
  }

  async insertDailyQueueItems(userId: string, queueDate: string, items: DailyQueueItemRow[]): Promise<void> {
    for (const it of items) {
      if (this.queueItems.some((q) => q.attemptId === it.attemptId)) continue; // unique attempt_id
      this.queueItems.push({ ...it, userId, queueDate, status: 'pending' });
    }
  }

  async countMasteryHistoryRows(userId: string): Promise<number> {
    return this.masteryHistory.filter((h) => h.userId === userId).length;
  }

  async listMasteryHistorySince(userId: string, sinceIso: string): Promise<MasteryHistoryRow[]> {
    const since = Date.parse(sinceIso);
    return this.masteryHistory
      .filter((h) => h.userId === userId && Date.parse(h.recordedAt) >= since)
      .map((h) => ({
        nodeId: h.nodeId,
        previousScore: h.previousScore,
        newScore: h.newScore,
        changeReason: h.changeReason,
        recordedAt: h.recordedAt,
      }));
  }

  /* ---------- §8.7 — جلسهٔ شبیه‌سازی آزمون (in-memory) ---------- */

  examSessions = new Map<
    string,
    import('./store').ExamSimulationSessionRow
  >();
  examSessionItems: import('./store').ExamSimulationItemRow[] = [];
  examSessionResponses: import('./store').ExamSimulationResponseRow[] = [];

  async createExamSimulationSession(input: {
    userId: string;
    level: string;
    examYear: number;
    subGroupId: string;
    bookletCode: string;
    plan: unknown;
    disclosures: string[];
    expiresAt: string;
    items: { questionId: string; sectionId: string; questionNumber: number; attemptId: string }[];
  }): Promise<import('./store').ExamSimulationSessionRow> {
    const now = new Date().toISOString();
    const session: import('./store').ExamSimulationSessionRow = {
      id: `exs-${crypto.randomUUID()}`,
      userId: input.userId,
      level: input.level,
      examYear: input.examYear,
      subGroupId: input.subGroupId,
      bookletCode: input.bookletCode,
      status: 'active',
      plan: input.plan,
      disclosures: input.disclosures,
      startedAt: now,
      expiresAt: input.expiresAt,
      submittedAt: null,
      report: null,
    };
    this.examSessions.set(session.id, session);
    for (const item of input.items) {
      this.examSessionItems.push({ sessionId: session.id, ...item });
    }
    return session;
  }

  async getExamSimulationSession(userId: string, sessionId: string): Promise<import('./store').ExamSimulationSessionRow | null> {
    const session = this.examSessions.get(sessionId);
    if (!session || session.userId !== userId) return null;
    return session;
  }

  async listExamSimulationItems(sessionId: string): Promise<import('./store').ExamSimulationItemRow[]> {
    return this.examSessionItems
      .filter((i) => i.sessionId === sessionId)
      .sort((a, b) => a.questionNumber - b.questionNumber);
  }

  async recordExamSimulationResponse(input: {
    userId: string;
    sessionId: string;
    attemptId: string;
    questionId: string;
    selectedOption: number;
    responseTimeMs?: number | null;
  }): Promise<void> {
    // ترتیب بررسی‌ها با RPC مهاجرت 0012 یکسان است:
    // جلسه → مالکیت → فعال‌بودن → انقضا → بلیت → سؤال → نوع تلاش → مصرف → آیتم → تکرار
    const session = this.examSessions.get(input.sessionId);
    if (!session) throw new Error('Exam session not found');
    if (session.userId !== input.userId) throw new Error('Exam session belongs to another user');
    if (session.status !== 'active') throw new Error('Exam session is not active');
    if (Date.parse(session.expiresAt) < Date.now()) throw new Error('Exam session expired');

    const ticket = this.tickets.get(input.attemptId);
    if (!ticket) throw new Error('Attempt ticket not found');
    if (ticket.userId !== input.userId) throw new Error('Attempt ticket belongs to another user');
    if (ticket.questionId !== input.questionId) throw new Error('Attempt ticket question mismatch');
    if (ticket.attemptType !== 'exam_simulation') throw new Error('Attempt ticket is not an exam simulation ticket');
    if (ticket.consumedAt) throw new Error('Attempt ticket already consumed');
    if (ticket.expiresAt <= Date.now()) throw new Error('Attempt ticket expired');

    const item = this.examSessionItems.find(
      (i) => i.sessionId === input.sessionId && i.questionId === input.questionId,
    );
    if (!item) throw new Error('Question is not part of this exam session');
    if (item.attemptId !== input.attemptId) throw new Error('Attempt ticket does not match session item');
    if (this.examSessionResponses.some((r) => r.sessionId === input.sessionId && r.questionId === input.questionId)) {
      throw new Error('Question already answered in this exam session');
    }

    const question = this.questions.find((candidate) => candidate.id === input.questionId);
    if (!question) throw new Error('Question not found');
    if (
      !Number.isInteger(input.selectedOption) ||
      input.selectedOption < 0 ||
      input.selectedOption >= question.options.length
    ) {
      throw new Error('Selected option is out of range');
    }

    ticket.consumedAt = new Date().toISOString();
    const isCorrect = input.selectedOption === question.correctOption;
    this.examSessionResponses.push({
      sessionId: input.sessionId,
      questionId: input.questionId,
      selectedOption: input.selectedOption,
      isCorrect,
      responseTimeMs: input.responseTimeMs ?? null,
      answeredAt: new Date().toISOString(),
    });
  }

  async listExamSimulationResponses(sessionId: string): Promise<import('./store').ExamSimulationResponseRow[]> {
    return this.examSessionResponses.filter((r) => r.sessionId === sessionId);
  }

  async submitExamSimulationSession(sessionId: string, report: unknown): Promise<void> {
    const session = this.examSessions.get(sessionId);
    if (!session) throw new Error('Exam session not found');
    session.status = 'scored';
    session.report = report;
    session.submittedAt = new Date().toISOString();
  }
}
