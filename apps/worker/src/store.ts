/**
 * لایهٔ دادهٔ worker — دو پیاده‌سازی:
 * - SupabaseStore: اتصال به Supabase PostgreSQL از طریق REST (کلید سرویس، فقط سمت سرور)
 * - MemoryStore: برای تست و محیط دمو
 */
import type {
  KnowledgeNode,
  NodeDependency,
  Question,
  ReviewCard,
  TrackId,
  UserNodeMastery,
} from '@ael/contracts';

export interface AppUser {
  id: string;
  telegramUserId?: number;
  displayName?: string;
  activeTracks: TrackId[];
}

export interface AnswerEvent {
  id: string;
  userId: string;
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
  attemptId: string;
  answeredAt: string;
  rippleReport: unknown;
}

export interface DataStore {
  getUser(userId: string): Promise<AppUser | null>;
  getUserByTelegramId(telegramUserId: number): Promise<AppUser | null>;
  createUser(input: { telegramUserId?: number; displayName?: string }): Promise<AppUser>;
  setActiveTracks(userId: string, tracks: TrackId[]): Promise<void>;

  listNodes(): Promise<KnowledgeNode[]>;
  listDependencies(): Promise<NodeDependency[]>;
  listQuestions(): Promise<Question[]>;

  listMastery(userId: string): Promise<UserNodeMastery[]>;
  upsertMastery(userId: string, rows: UserNodeMastery[]): Promise<void>;

  listCards(userId: string): Promise<ReviewCard[]>;
  upsertCards(cards: ReviewCard[]): Promise<void>;

  findAnswerByAttempt(userId: string, attemptId: string): Promise<AnswerEvent | null>;
  insertAnswerEvent(event: AnswerEvent): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Supabase REST implementation                                        */
/* ------------------------------------------------------------------ */

export class SupabaseStore implements DataStore {
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  private async request(
    method: string,
    path: string,
    body?: unknown,
    query = '',
  ): Promise<unknown> {
    const res = await fetch(`${this.url}/rest/v1/${path}${query}`, {
      method,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        ...(method === 'POST' ? { Prefer: 'resolution=merge-duplicates' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Supabase ${method} ${path}: ${res.status} ${await res.text()}`);
    }
    if (method === 'GET' && res.status === 204) return [];
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  private toUser(row: Record<string, unknown>): AppUser {
    return {
      id: String(row.id),
      telegramUserId: row.telegram_user_id === null ? undefined : Number(row.telegram_user_id),
      displayName: row.display_name === null ? undefined : String(row.display_name),
      activeTracks: (row.active_tracks as TrackId[]) ?? ['common'],
    };
  }

  async getUser(userId: string): Promise<AppUser | null> {
    const rows = (await this.request('GET', 'app_users', undefined, `?id=eq.${userId}&select=*`)) as
      | Record<string, unknown>[]
      | null;
    const row = rows?.[0];
    return row ? this.toUser(row) : null;
  }

  async getUserByTelegramId(telegramUserId: number): Promise<AppUser | null> {
    const rows = (await this.request(
      'GET',
      'app_users',
      undefined,
      `?telegram_user_id=eq.${telegramUserId}&select=*`,
    )) as Record<string, unknown>[] | null;
    const row = rows?.[0];
    return row ? this.toUser(row) : null;
  }

  async createUser(input: { telegramUserId?: number; displayName?: string }): Promise<AppUser> {
    const rows = (await this.request('POST', 'app_users', [
      {
        telegram_user_id: input.telegramUserId ?? null,
        display_name: input.displayName ?? null,
      },
    ])) as Record<string, unknown>[];
    return this.toUser(rows[0] ?? {});
  }

  async setActiveTracks(userId: string, tracks: TrackId[]): Promise<void> {
    await this.request(
      'PATCH',
      `app_users?id=eq.${userId}`,
      { active_tracks: tracks },
    );
  }

  async listNodes(): Promise<KnowledgeNode[]> {
    return (await this.request('GET', 'knowledge_nodes', undefined, '?select=*')) as KnowledgeNode[];
  }

  async listDependencies(): Promise<NodeDependency[]> {
    const rows = (await this.request(
      'GET',
      'node_dependencies',
      undefined,
      '?select=source_node_id,target_node_id,relation,impact_weight',
    )) as {
      source_node_id: string;
      target_node_id: string;
      relation: NodeDependency['relation'];
      impact_weight: number;
    }[];
    return rows.map((r) => ({
      source: r.source_node_id,
      target: r.target_node_id,
      relation: r.relation,
      weight: Number(r.impact_weight),
    }));
  }

  async listQuestions(): Promise<Question[]> {
    const rows = (await this.request(
      'GET',
      'questions',
      undefined,
      '?verification_status=in.(verified,demo)&select=*',
    )) as {
      id: string;
      node_id: string;
      exam_year: number | null;
      question_text: string;
      options: string[];
      correct_option: number;
      explanation: string | null;
      trap_note: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      nodeId: r.node_id,
      examYear: r.exam_year ?? undefined,
      text: r.question_text,
      options: r.options,
      correctOption: r.correct_option,
      explanation: r.explanation ?? undefined,
      trapNote: r.trap_note ?? undefined,
    }));
  }

  async listMastery(userId: string): Promise<UserNodeMastery[]> {
    const rows = (await this.request(
      'GET',
      'user_node_mastery',
      undefined,
      `?user_id=eq.${userId}&select=*`,
    )) as {
      node_id: string;
      mastery_score: number;
      status: UserNodeMastery['status'];
      last_error_at: string | null;
    }[];
    return rows.map((r) => ({
      nodeId: r.node_id,
      mastery: Number(r.mastery_score),
      status: r.status,
      lastErrorAt: r.last_error_at ?? undefined,
    }));
  }

  async upsertMastery(userId: string, rows: UserNodeMastery[]): Promise<void> {
    if (rows.length === 0) return;
    await this.request(
      'POST',
      'user_node_mastery',
      rows.map((r) => ({
        user_id: userId,
        node_id: r.nodeId,
        mastery_score: r.mastery,
        status: r.status,
        last_error_at: r.lastErrorAt ?? null,
      })),
    );
  }

  async listCards(userId: string): Promise<ReviewCard[]> {
    const rows = (await this.request(
      'GET',
      'review_cards',
      undefined,
      `?user_id=eq.${userId}&select=*`,
    )) as {
      id: string;
      node_id: string;
      card_type: ReviewCard['cardType'];
      question_id: string | null;
      trap_card_id: string | null;
      due_at: string;
      interval_days: number;
      previous_interval_days: number | null;
      ease: number;
      is_repair: boolean;
      times_seen: number;
      times_correct: number;
    }[];
    return rows.map((r) => ({
      id: r.id,
      userId,
      nodeId: r.node_id,
      cardType: r.card_type,
      questionId: r.question_id ?? undefined,
      trapCardId: r.trap_card_id ?? undefined,
      dueAt: r.due_at,
      intervalDays: r.interval_days,
      previousIntervalDays: r.previous_interval_days ?? undefined,
      ease: Number(r.ease),
      isRepair: r.is_repair,
      timesSeen: r.times_seen,
      timesCorrect: r.times_correct,
    }));
  }

  async upsertCards(cards: ReviewCard[]): Promise<void> {
    if (cards.length === 0) return;
    await this.request(
      'POST',
      'review_cards',
      cards.map((c) => ({
        id: c.id,
        user_id: c.userId,
        node_id: c.nodeId,
        card_type: c.cardType,
        question_id: c.questionId ?? null,
        trap_card_id: c.trapCardId ?? null,
        due_at: c.dueAt,
        interval_days: c.intervalDays,
        previous_interval_days: c.previousIntervalDays ?? null,
        ease: c.ease,
        is_repair: c.isRepair,
        times_seen: c.timesSeen,
        times_correct: c.timesCorrect,
      })),
    );
  }

  async findAnswerByAttempt(userId: string, attemptId: string): Promise<AnswerEvent | null> {
    const rows = (await this.request(
      'GET',
      'answer_events',
      undefined,
      `?user_id=eq.${userId}&attempt_id=eq.${attemptId}&select=*`,
    )) as Record<string, unknown>[] | null;
    const row = rows?.[0];
    return row
      ? {
          id: String(row.id),
          userId: String(row.user_id),
          questionId: String(row.question_id),
          selectedOption: Number(row.selected_option),
          isCorrect: Boolean(row.is_correct),
          attemptId: String(row.attempt_id),
          answeredAt: String(row.answered_at),
          rippleReport: row.ripple_report,
        }
      : null;
  }

  async insertAnswerEvent(event: AnswerEvent): Promise<void> {
    await this.request('POST', 'answer_events', {
      user_id: event.userId,
      question_id: event.questionId,
      selected_option: event.selectedOption,
      is_correct: event.isCorrect,
      attempt_id: event.attemptId,
      answered_at: event.answeredAt,
      ripple_report: event.rippleReport,
    });
  }
}
