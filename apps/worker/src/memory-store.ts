import { defaultSeed } from './default-seed';
/** پیاده‌سازی درون‌حافظه‌ای لایهٔ داده — برای تست و دمو */
import type { LearnerSkillState, ReviewCard, TrackId, UserNodeMastery } from '@ael/contracts';
import type { AnswerEvent, AppUser, AttemptTicket, DataStore } from './store';

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
    else if (defaultSeed?.questions) this.questions = (defaultSeed.questions as unknown as any[]).map((q) => ({ ...q }));
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
    for (const r of rows) this.mastery.set(`${userId}:${r.nodeId}`, r);
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
    const ticket = this.tickets.get(input.attemptId);
    if (!ticket) throw new Error('Attempt ticket not found');
    if (ticket.userId !== input.userId) throw new Error('Attempt ticket belongs to another user');
    if (ticket.questionId !== input.questionId) throw new Error('Attempt ticket question mismatch');
    if (ticket.consumedAt) throw new Error('Attempt ticket already consumed');
    if (ticket.expiresAt <= Date.now()) throw new Error('Attempt ticket expired');

    const question = this.questions.find((candidate) => candidate.id === input.questionId);
    if (!question) throw new Error('Question not found');
    if (!Number.isInteger(input.selectedOption) || input.selectedOption < 0 || input.selectedOption >= question.options.length) {
      throw new Error('Selected option is out of range');
    }

    // Match the production RPC: the server-side answer key is authoritative.
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
      });
    }
  }

  tickets = new Map<string, {
    userId: string;
    questionId: string;
    attemptType: string;
    consumedAt?: string;
    expiresAt: number;
  }>();

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
}
