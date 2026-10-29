import { defaultSeed } from './default-seed';
/** پیاده‌سازی درون‌حافظه‌ای لایهٔ داده — برای تست و دمو */
import type { ReviewCard, TrackId, UserNodeMastery } from '@ael/contracts';
import type { AnswerEvent, AppUser, DataStore } from './store';

export class MemoryStore implements DataStore {
  users = new Map<string, AppUser>();
  private tgIndex = new Map<number, string>();
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

  async createUser(input: { telegramUserId?: number; displayName?: string }): Promise<AppUser> {
    const id = `user-${++this.seq}`;
    const user: AppUser = {
      id,
      telegramUserId: input.telegramUserId,
      displayName: input.displayName,
      activeTracks: ['common'],
    };
    this.users.set(id, user);
    if (input.telegramUserId) this.tgIndex.set(input.telegramUserId, id);
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
  }): Promise<void> {
    await this.insertAnswerEvent({
      id: crypto.randomUUID(),
      userId: input.userId,
      questionId: input.questionId,
      selectedOption: input.selectedOption,
      isCorrect: input.wasCorrect,
      attemptId: input.attemptId,
      answeredAt: new Date().toISOString(),
      rippleReport: input.rippleReport,
    });
    await this.upsertMastery(input.userId, input.masteryUpdates);
    await this.upsertCards([...input.cardUpserts, ...input.cardInserts]);
  }
}
