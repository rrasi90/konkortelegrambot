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
}
