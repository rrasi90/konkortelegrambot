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

/** آمار انگیزشی کاربر (واژه‌راه-مانند): سکه، روز پیوسته، شمارهٔ روز و تاریخ کنکور */
export interface UserStats {
  userId: string;
  coins: number;
  streakDays: number;
  /** YYYY-MM-DD — آخرین روز مطالعه (به وقت تهران) */
  lastStudyDate: string | null;
  dayNumber: number;
  /** YYYY-MM-DD — تاریخ کنکور داوطلب */
  examDate: string | null;
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

  getStats(userId: string): Promise<UserStats | null>;
  upsertStats(stats: UserStats): Promise<void>;
  /** پاسخ‌های کاربر از یک زمان به بعد (برای کوییز شبانه و آمار امروز) */
  listAnswersSince(userId: string, sinceIso: string): Promise<AnswerEvent[]>;

  listNodes(): Promise<KnowledgeNode[]>;
  listDependencies(): Promise<NodeDependency[]>;
  listQuestions(): Promise<Question[]>;

  listMastery(userId: string): Promise<UserNodeMastery[]>;
  upsertMastery(userId: string, rows: UserNodeMastery[]): Promise<void>;

  listCards(userId: string): Promise<ReviewCard[]>;
  upsertCards(cards: ReviewCard[]): Promise<void>;

  findAnswerByAttempt(userId: string, attemptId: string): Promise<AnswerEvent | null>;
  insertAnswerEvent(event: AnswerEvent): Promise<void>;

  /** ثبت اتمی پاسخ، تسلط و کارت‌ها در یک تراکنش */
  submitAnswerAtomic(input: {
    userId: string;
    questionId: string;
    selectedOption: number;
    attemptId: string;
    wasCorrect: boolean;
    rippleReport: unknown;
    masteryUpdates: UserNodeMastery[];
    cardUpserts: ReviewCard[];
    cardInserts: ReviewCard[];
  }): Promise<void>;
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
        ...(method === 'POST' ? { Prefer: 'resolution=merge-duplicates,return=representation' } : {}),
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

  async getStats(userId: string): Promise<UserStats | null> {
    const rows = (await this.request(
      'GET',
      'app_users',
      undefined,
      `?id=eq.${userId}&select=coins,streak_days,last_study_date,day_number,exam_date`,
    )) as Record<string, unknown>[] | null;
    const row = rows?.[0];
    if (!row) return null;
    return {
      userId,
      coins: Number(row.coins ?? 0),
      streakDays: Number(row.streak_days ?? 0),
      lastStudyDate: row.last_study_date ? String(row.last_study_date) : null,
      dayNumber: Number(row.day_number ?? 0),
      examDate: row.exam_date ? String(row.exam_date) : null,
    };
  }

  async upsertStats(stats: UserStats): Promise<void> {
    await this.request('PATCH', `app_users?id=eq.${stats.userId}`, {
      coins: stats.coins,
      streak_days: stats.streakDays,
      last_study_date: stats.lastStudyDate,
      day_number: stats.dayNumber,
      exam_date: stats.examDate,
    });
  }

  async listAnswersSince(userId: string, sinceIso: string): Promise<AnswerEvent[]> {
    const rows = (await this.request(
      'GET',
      'answer_events',
      undefined,
      `?user_id=eq.${userId}&answered_at=gte.${sinceIso}&select=*`,
    )) as Record<string, unknown>[] | null;
    return (rows ?? []).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      questionId: String(row.question_id),
      selectedOption: Number(row.selected_option),
      isCorrect: Boolean(row.is_correct),
      attemptId: String(row.attempt_id),
      answeredAt: String(row.answered_at),
      rippleReport: row.ripple_report,
    }));
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
    // تبدیل آرایه‌ها به فرمت JSONB مناسب برای تابع دیتابیس
    const masteryUpdatesJson = input.masteryUpdates.map(m => ({
      nodeId: m.nodeId,
      mastery: m.mastery,
      status: m.status,
      lastErrorAt: m.lastErrorAt ?? null,
    }));
    const cardUpsertsJson = input.cardUpserts.map(c => ({
      id: c.id,
      userId: c.userId,
      dueAt: c.dueAt,
      intervalDays: c.intervalDays,
      previousIntervalDays: c.previousIntervalDays ?? null,
      ease: c.ease,
      isRepair: c.isRepair,
      timesSeen: c.timesSeen,
      timesCorrect: c.timesCorrect,
    }));
    const cardInsertsJson = input.cardInserts.map(c => ({
      id: c.id,
      userId: c.userId,
      nodeId: c.nodeId,
      cardType: c.cardType,
      questionId: c.questionId ?? null,
      trapCardId: c.trapCardId ?? null,
      dueAt: c.dueAt,
      intervalDays: c.intervalDays,
      previousIntervalDays: c.previousIntervalDays ?? null,
      ease: c.ease,
      isRepair: c.isRepair,
      timesSeen: c.timesSeen,
      timesCorrect: c.timesCorrect,
    }));

    await this.request('POST', 'rpc/submit_answer_atomic', {
      p_user_id: input.userId,
      p_question_id: input.questionId,
      p_selected_option: input.selectedOption,
      p_attempt_id: input.attemptId,
      p_was_correct: input.wasCorrect,
      p_ripple_report: input.rippleReport,
      p_mastery_updates: masteryUpdatesJson,
      p_card_upserts: cardUpsertsJson,
      p_card_inserts: cardInsertsJson,
    });
  }
}
