/**
 * لایهٔ دادهٔ worker — دو پیاده‌سازی:
 * - SupabaseStore: اتصال به Supabase PostgreSQL از طریق REST (کلید سرویس، فقط سمت سرور)
 * - MemoryStore: برای تست و محیط دمو
 */
import type {
  KnowledgeNode,
  LearnerSkillState,
  NodeDependency,
  Question,
  ReviewCard,
  TrackId,
  UserNodeMastery,
} from '@ael/contracts';

export interface AppUser {
  id: string;
  telegramUserId?: number;
  telegramUsername?: string;
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
  /** تعداد روزهایی که قفل خریده‌شده واقعاً برای حفظ زنجیره مصرف شده است */
  streakFreezeUsed: number;
  /** تعداد قفل‌های خریداری‌شده در ماه جاری */
  streakFreezeGranted: number;
  /** ماه مصرف شمارندهٔ قفل (YYYY-MM)؛ با تغییر ماه، شمارنده‌ها بازنشانی می‌شوند */
  streakFreezeMonth: string | null;
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

export interface MasteryHistoryRow {
  nodeId: string;
  previousScore: number | null;
  newScore: number;
  changeReason: string;
  recordedAt: string;
}

export type IssuedAttemptType = 'practice' | 'diagnostic' | 'verification' | 'proof' | 'holdout' | 'exam_simulation';

export interface AttemptTicket {
  attemptId: string;
  userId: string;
  questionId: string;
  attemptType: IssuedAttemptType;
  consumedAt: string | null;
  expiresAt: string;
}

/** R-020 — انتخاب کنکور داوطلب (جداول exam_selections / audit_logs / daily_queue_items) */
export interface ExamSelection {
  examYear: number;
  subGroupId: string;
  combinationCode: string | null;
  setCode: string | null;
  selectedAt: string;
}

export interface AuditEventInput {
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: unknown;
  sourceIp?: string | null;
}

export type QueueItemReason =
  | 'scheduled'
  | 'review'
  | 'new_material'
  | 'remedial'
  | 'proof'
  | 'night_quiz'
  | 'exam_simulation'
  | 'diagnostic';

export interface DailyQueueItemRow {
  attemptId: string;
  questionId: string;
  nodeId?: string | null;
  reason: QueueItemReason;
  priority?: number | null;
}

/* ---------- §8.7 — جلسهٔ شبیه‌سازی آزمون ---------- */

export type ExamSimulationSessionStatus = 'active' | 'submitted' | 'scored';

export interface ExamSimulationSessionRow {
  id: string;
  userId: string;
  level: string;
  examYear: number;
  subGroupId: string;
  bookletCode: string;
  status: ExamSimulationSessionStatus;
  /** عکسِ برنامهٔ جلسه (ساختار رسمی + تخصیص + افشاها) برای نمره‌دهی بازتولیدپذیر */
  plan: unknown;
  disclosures: string[];
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  report: unknown | null;
}

export interface ExamSimulationItemRow {
  sessionId: string;
  questionId: string;
  sectionId: string;
  questionNumber: number;
  attemptId: string;
}

export interface ExamSimulationResponseRow {
  sessionId: string;
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
  responseTimeMs: number | null;
  answeredAt: string;
}

export interface DataStore {
  getUser(userId: string): Promise<AppUser | null>;
  getUserByTelegramId(telegramUserId: number): Promise<AppUser | null>;
  getUserByTelegramUsername?(username: string): Promise<AppUser | null>;
  createUser(input: { telegramUserId?: number; telegramUsername?: string; displayName?: string }): Promise<AppUser>;
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

  /** ثبت اتمی و امن پاسخ، تسلط و کارت‌ها (RPC امن مهاجرت 0006) */
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
  }): Promise<{ correctOption?: number; replay?: boolean } | null>;

  /** صدور بلیت تلاش برای هر آیتم صف (مصرف در submit_answer_secure) */
  issueAttemptTickets(
    userId: string,
    tickets: { attemptId: string; questionId: string; attemptType: 'practice' | 'diagnostic' | 'verification' | 'proof' | 'holdout' | 'exam_simulation'; itemVersion?: string }[],
  ): Promise<void>;

  /** خواندن بلیت صادرشده برای اعتبارسنجی سمت سرور (نوع تلاش از client پذیرفته نمی‌شود) */
  getAttemptTicket(userId: string, attemptId: string, questionId: string): Promise<AttemptTicket | null>;

  /** وضعیت شش‌بعدی مهارت‌های کاربر (learner_skill_states) */
  getSkillStates(userId: string): Promise<LearnerSkillState[]>;
  /** ثبت وضعیت شش‌بعدی یک مهارت */
  upsertSkillState(userId: string, update: {
    skillId: string;
    nodeId: string;
    state: LearnerSkillState;
  }): Promise<void>;

  /** فهرست گرایش‌ها از بسته‌های آزمون (برای /api/tracks داینامیک) */
  listPacks(): Promise<{ packId: string; title: string; tracks: TrackId[]; isDemo: boolean }[]>;

  /* ---------- R-020 — جداول دامنهٔ مفقود ---------- */

  /** ذخیره/به‌روزرسانی انتخاب کنکور فعال کاربر (جدول exam_selections) */
  saveExamSelection(userId: string, input: {
    examYear: number;
    subGroupId: string;
    combinationCode?: string | null;
    setCode?: string | null;
  }): Promise<ExamSelection>;
  getActiveExamSelection(userId: string): Promise<ExamSelection | null>;

  /** ثبت رویداد حساس در audit_logs (best-effort سمت worker) */
  logAudit(event: AuditEventInput): Promise<void>;

  /** persists issued queue items (daily_queue_items) */
  insertDailyQueueItems(userId: string, queueDate: string, items: DailyQueueItemRow[]): Promise<void>;

  /** ردیف‌های تاریخچهٔ تسلط نوشته‌شده توسط trigger (مخصوص تست/ممیزی) */
  countMasteryHistoryRows(userId: string): Promise<number>;

  /** تغییرات تسلط از یک زمان به بعد — مبنای شاخص سرعت یادگیری (§8.10) */
  listMasteryHistorySince(userId: string, sinceIso: string): Promise<MasteryHistoryRow[]>;

  /* ---------- §8.7 — جلسهٔ شبیه‌سازی آزمون ---------- */

  /** ساخت جلسه + اقلام آن (برگهٔ پاسخ) */
  createExamSimulationSession(input: {
    userId: string;
    level: string;
    examYear: number;
    subGroupId: string;
    bookletCode: string;
    plan: unknown;
    disclosures: string[];
    expiresAt: string;
    items: { questionId: string; sectionId: string; questionNumber: number; attemptId: string }[];
  }): Promise<ExamSimulationSessionRow>;

  getExamSimulationSession(userId: string, sessionId: string): Promise<ExamSimulationSessionRow | null>;

  beginExamSimulationSubmission(userId: string, sessionId: string): Promise<ExamSimulationSessionRow>;

  listExamSimulationItems(sessionId: string): Promise<ExamSimulationItemRow[]>;

  /**
   * ثبت اتمیک پاسخ شبیه‌سازی: بلیتِ exam_simulation مصرف می‌شود و درستی
   * سمت سرور از بانک سؤال تعیین می‌گردد (کلاینت نمی‌تواند خودش را درست اعلام کند).
   */
  recordExamSimulationResponse(input: {
    userId: string;
    sessionId: string;
    attemptId: string;
    questionId: string;
    selectedOption: number;
    responseTimeMs?: number | null;
  }): Promise<void>;

  listExamSimulationResponses(sessionId: string): Promise<ExamSimulationResponseRow[]>;

  /** بستن جلسه و ذخیرهٔ گزارش نمره */
  submitExamSimulationSession(userId: string, sessionId: string, report: unknown): Promise<unknown>;
}

/* ------------------------------------------------------------------ */
/* Supabase REST implementation                                        */
/* ------------------------------------------------------------------ */

export class SupabaseStore implements DataStore {
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  // کشک isotopes برای محتوای استاتیک که در هر درخواست دوباره بارگذاری می‌شود
  private _nodesCache: KnowledgeNode[] | null = null;
  private _questionsCache: Question[] | null = null;

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
      telegramUserId:
        row.telegram_user_id === null || row.telegram_user_id === undefined
          ? undefined
          : Number(row.telegram_user_id),
      telegramUsername:
        row.telegram_username === null || row.telegram_username === undefined
          ? undefined
          : String(row.telegram_username),
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

  async getUserByTelegramUsername(username: string): Promise<AppUser | null> {
    const clean = username.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return null;
    const rows = (await this.request(
      'GET',
      'app_users',
      undefined,
      `?telegram_username=eq.${encodeURIComponent(clean)}&select=*`,
    )) as Record<string, unknown>[] | null;
    const row = rows?.[0];
    return row ? this.toUser(row) : null;
  }

  async createUser(input: {
    telegramUserId?: number;
    telegramUsername?: string;
    displayName?: string;
  }): Promise<AppUser> {
    const username = input.telegramUsername
      ? input.telegramUsername.replace(/^@/, '').trim().toLowerCase() || null
      : null;
    try {
      const rows = (await this.request('POST', 'app_users', [
        {
          telegram_user_id: input.telegramUserId ?? null,
          telegram_username: username,
          display_name: input.displayName ?? null,
        },
      ])) as Record<string, unknown>[];
      const row = rows?.[0];
      if (!row) throw new Error('Supabase createUser: empty response');
      return this.toUser(row);
    } catch (err) {
      // دو ورود هم‌زمان می‌توانند هر دو «کاربر جدید» ببینند؛ در این حالت
      // رکورد ساخته‌شده توسط درخواست موازی را برمی‌گردانیم تا حساب تکرار نشود.
      if (input.telegramUserId) {
        const byId = await this.getUserByTelegramId(input.telegramUserId).catch(() => null);
        if (byId) return byId;
      }
      if (username) {
        const byName = await this.getUserByTelegramUsername(username).catch(() => null);
        if (byName) return byName;
      }
      throw err;
    }
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
      `?id=eq.${userId}&select=coins,streak_days,last_study_date,day_number,exam_date,streak_freeze_used,streak_freeze_granted,streak_freeze_month`,
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
      streakFreezeUsed: Number(row.streak_freeze_used ?? 0),
      streakFreezeGranted: Number(row.streak_freeze_granted ?? 0),
      streakFreezeMonth: row.streak_freeze_month ? String(row.streak_freeze_month) : null,
    };
  }

  async upsertStats(stats: UserStats): Promise<void> {
    await this.request('PATCH', `app_users?id=eq.${stats.userId}`, {
      coins: stats.coins,
      streak_days: stats.streakDays,
      last_study_date: stats.lastStudyDate,
      day_number: stats.dayNumber,
      exam_date: stats.examDate,
      streak_freeze_used: stats.streakFreezeUsed,
      streak_freeze_granted: stats.streakFreezeGranted,
      streak_freeze_month: stats.streakFreezeMonth,
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
    if (this._nodesCache) return this._nodesCache;
    const nodes = (await this.request('GET', 'knowledge_nodes', undefined, '?select=*')) as KnowledgeNode[];
    this._nodesCache = nodes;
    return nodes;
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
    if (this._questionsCache) return this._questionsCache;
    const rows = (await this.request(
      'GET',
      'v_worker_question_access',
      undefined,
      '?select=id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,exam_level,content_origin,verification_status,access_type',
    )) as {
      id: string;
      node_id: string;
      exam_year: number | null;
      question_text: string;
      options: string[];
      correct_option: number;
      explanation: string | null;
      trap_note: string | null;
      exam_level: string | null;
      content_origin: string | null;
      verification_status: string | null;
      access_type: string;
    }[];
    const questions = rows.map((r): Question => {
      if (r.access_type !== 'practice' && r.access_type !== 'proof') {
        throw new Error('Unexpected question access classification');
      }
      return {
        id: r.id,
        nodeId: r.node_id,
        examYear: r.exam_year ?? undefined,
        text: r.question_text,
        options: r.options,
        correctOption: r.correct_option,
        explanation: r.explanation ?? undefined,
        trapNote: r.trap_note ?? undefined,
        examLevel: (r.exam_level ?? undefined) as Question['examLevel'],
        contentOrigin: (r.content_origin ?? undefined) as Question['contentOrigin'],
        // MemoryStore مقدار isVerified را از seed نگه می‌دارد؛ اینجا باید از
        // verification_status خوانده شود وگرنه در پروداکشن همیشه false است.
        isVerified: r.verification_status === 'verified',
        accessType: r.access_type,
      };
    });
    this._questionsCache = questions;
    return questions;
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
      comparison_skills: [string, string] | null;
      due_at: string;
      interval_days: number;
      previous_interval_days: number | null;
      ease: number;
      is_repair: boolean;
      times_seen: number;
      times_correct: number;
      fsrs_state: ReviewCard['fsrs'] | null;
      is_proof: boolean;
    }[];
    return rows.map((r) => ({
      id: r.id,
      userId,
      nodeId: r.node_id,
      cardType: r.card_type,
      questionId: r.question_id ?? undefined,
      trapCardId: r.trap_card_id ?? undefined,
      comparisonSkills: r.comparison_skills ?? undefined,
      dueAt: r.due_at,
      intervalDays: r.interval_days,
      previousIntervalDays: r.previous_interval_days ?? undefined,
      ease: Number(r.ease),
      isRepair: r.is_repair,
      timesSeen: r.times_seen,
      timesCorrect: r.times_correct,
      fsrs: r.fsrs_state ?? undefined,
      isProof: r.is_proof,
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
        comparison_skills: c.comparisonSkills ?? null,
        due_at: c.dueAt,
        interval_days: c.intervalDays,
        previous_interval_days: c.previousIntervalDays ?? null,
        ease: c.ease,
        is_repair: c.isRepair,
        times_seen: c.timesSeen,
        times_correct: c.timesCorrect,
        fsrs_state: c.fsrs ?? null,
        is_proof: c.isProof ?? false,
      })),
    );
  }

  async findAnswerByAttempt(userId: string, attemptId: string): Promise<AnswerEvent | null> {
    const rows = (await this.request(
      'GET',
      'answer_events',
      undefined,
      `?user_id=eq.${encodeURIComponent(userId)}&attempt_id=eq.${encodeURIComponent(attemptId)}&select=*`,
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
  }): Promise<{ correctOption?: number; replay?: boolean } | null> {
    // تبدیل آرایه‌ها به فرمت JSONB موردانتظار تابع امن submit_answer_secure (مهاجرت 0006)
    const masteryUpdatesJson = input.masteryUpdates.map((m) => ({
      nodeId: m.nodeId,
      mastery: m.mastery,
      status: m.status,
      lastErrorAt: m.lastErrorAt ?? null,
    }));
    const cardUpsertsJson = input.cardUpserts.map((c) => ({
      id: c.id,
      userId: c.userId,
      dueAt: c.dueAt,
      intervalDays: c.intervalDays,
      previousIntervalDays: c.previousIntervalDays ?? null,
      ease: c.ease,
      isRepair: c.isRepair,
      timesSeen: c.timesSeen,
      timesCorrect: c.timesCorrect,
      fsrsState: c.fsrs ?? null,
      isProof: c.isProof ?? false,
      comparisonSkills: c.comparisonSkills ?? null,
    }));
    const cardInsertsJson = input.cardInserts.map((c) => ({
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
      fsrsState: c.fsrs ?? null,
      isProof: c.isProof ?? false,
      comparisonSkills: c.comparisonSkills ?? null,
    }));

    // RPC امن: کلید صحیح سمت سرور تعیین و بلیت تلاش مصرف می‌شود
    const feedback = (await this.request('POST', 'rpc/submit_answer_secure', {
      p_user_id: input.userId,
      p_attempt_id: input.attemptId,
      p_question_id: input.questionId,
      p_selected_option: input.selectedOption,
      p_ripple_report: input.rippleReport,
      p_mastery_updates: masteryUpdatesJson,
      p_card_upserts: cardUpsertsJson,
      p_card_inserts: cardInsertsJson,
    })) as { correctOption?: number; replay?: boolean } | null;
    return feedback;
  }

  async issueAttemptTickets(
    userId: string,
    tickets: {
      attemptId: string;
      questionId: string;
      attemptType: 'practice' | 'diagnostic' | 'verification' | 'proof' | 'holdout' | 'exam_simulation';
      itemVersion?: string;
    }[],
  ): Promise<void> {
    if (tickets.length === 0) return;
    await this.request(
      'POST',
      'attempt_tickets',
      tickets.map((t) => ({
        attempt_id: t.attemptId,
        user_id: userId,
        question_id: t.questionId,
        attempt_type: t.attemptType,
        item_version: t.itemVersion ?? '1',
      })),
    );
  }

  async getAttemptTicket(userId: string, attemptId: string, questionId: string): Promise<AttemptTicket | null> {
    const rows = (await this.request(
      'GET',
      'attempt_tickets',
      undefined,
      `?attempt_id=eq.${encodeURIComponent(attemptId)}&user_id=eq.${encodeURIComponent(userId)}&question_id=eq.${encodeURIComponent(questionId)}&select=attempt_id,user_id,question_id,attempt_type,consumed_at,expires_at`,
    )) as Record<string, unknown>[] | null;
    const row = rows?.[0];
    if (!row) return null;
    return {
      attemptId: String(row.attempt_id),
      userId: String(row.user_id),
      questionId: String(row.question_id),
      attemptType: String(row.attempt_type) as IssuedAttemptType,
      consumedAt: row.consumed_at == null ? null : String(row.consumed_at),
      expiresAt: String(row.expires_at),
    };
  }

  async getSkillStates(userId: string): Promise<LearnerSkillState[]> {
    const rows = (await this.request(
      'GET',
      'learner_skill_states',
      undefined,
      `?user_id=eq.${userId}&select=*`,
    )) as {
      skill_id: string;
      proficiency_probability: number;
      confidence: number;
      evidence_count: number;
      memory_retrievability: number;
      fluency_speed_ratio: number;
      dominant_error_type: string;
      coverage_status: LearnerSkillState['coverageStatus'];
    }[];
    return rows.map((r) => ({
      skillId: r.skill_id,
      userId,
      proficiencyProbability: Number(r.proficiency_probability),
      confidence: Number(r.confidence),
      evidenceCount: Number(r.evidence_count),
      memoryRetrievability: Number(r.memory_retrievability),
      fluencySpeedRatio: Number(r.fluency_speed_ratio),
      dominantErrorType: r.dominant_error_type,
      coverageStatus: r.coverage_status,
    }));
  }

  async upsertSkillState(
    userId: string,
    update: { skillId: string; nodeId: string; state: LearnerSkillState },
  ): Promise<void> {
    await this.request(
      'POST',
      'learner_skill_states?on_conflict=user_id,skill_id',
      {
        user_id: userId,
        skill_id: update.skillId,
        proficiency_probability: update.state.proficiencyProbability,
        confidence: update.state.confidence,
        evidence_count: update.state.evidenceCount,
        memory_retrievability: update.state.memoryRetrievability,
        fluency_speed_ratio: update.state.fluencySpeedRatio,
        dominant_error_type: update.state.dominantErrorType,
        coverage_status: update.state.coverageStatus,
      },
    );
  }

  async listPacks(): Promise<{ packId: string; title: string; tracks: TrackId[]; isDemo: boolean }[]> {
    // exam_packs ستون‌های pack_id/title/tracks/is_demo ندارد؛ نگاشت روی
    // ستون‌های واقعی انجام می‌شود (وگرنه PostgREST خطای ۴۰۰ می‌دهد و /api/tracks
    // همیشه بستهٔ خالی برمی‌گرداند).
    const rows = (await this.request(
      'GET',
      'exam_packs',
      undefined,
      '?select=id,name,track,status,rights_status,metadata&is_active=is.true',
    )) as {
      id: string;
      name: string;
      track: string;
      status: string;
      rights_status: string;
      metadata: Record<string, unknown> | null;
    }[];
    return (rows ?? []).map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      const metaTracks = Array.isArray(meta.tracks) ? (meta.tracks as unknown[]).map(String) : [];
      return {
        packId: r.id,
        title: r.name,
        tracks: (metaTracks.length > 0 ? metaTracks : [r.track]) as TrackId[],
        isDemo: meta.synthetic === true || r.status === 'draft',
      };
    });
  }

  /* ---------- R-020 implementations ---------- */

  async saveExamSelection(userId: string, input: {
    examYear: number;
    subGroupId: string;
    combinationCode?: string | null;
    setCode?: string | null;
  }): Promise<ExamSelection> {
    // یکتایی (user_id, exam_year) در 0011 تعریف شده؛ بدون on_conflict، دومین
    // PUT برای همان سال خطای duplicate key می‌داد (MemoryStore با Map.set این
    // واگرایی را پنهان می‌کرد).
    const rows = (await this.request('POST', 'exam_selections?on_conflict=user_id,exam_year', {
      user_id: userId,
      exam_year: input.examYear,
      sub_group_id: input.subGroupId,
      combination_code: input.combinationCode ?? null,
      set_code: input.setCode ?? null,
      is_active: true,
      selected_at: new Date().toISOString(),
    })) as Record<string, unknown>[] | null;
    const row = rows?.[0] ?? {};
    return {
      examYear: Number(row.exam_year ?? input.examYear),
      subGroupId: String(row.sub_group_id ?? input.subGroupId),
      combinationCode: row.combination_code == null ? input.combinationCode ?? null : String(row.combination_code),
      setCode: row.set_code == null ? input.setCode ?? null : String(row.set_code),
      selectedAt: String(row.selected_at ?? new Date().toISOString()),
    };
  }

  async getActiveExamSelection(userId: string): Promise<ExamSelection | null> {
    const rows = (await this.request(
      'GET',
      'exam_selections',
      undefined,
      `?user_id=eq.${encodeURIComponent(userId)}&is_active=is.true&order=selected_at.desc&limit=1`,
    )) as Record<string, unknown>[] | null;
    const row = rows?.[0];
    if (!row) return null;
    return {
      examYear: Number(row.exam_year),
      subGroupId: String(row.sub_group_id),
      combinationCode: row.combination_code == null ? null : String(row.combination_code),
      setCode: row.set_code == null ? null : String(row.set_code),
      selectedAt: String(row.selected_at),
    };
  }

  async logAudit(event: AuditEventInput): Promise<void> {
    // audit_logs کلید یکتا ندارد؛ درج ساده بدون merge (helper مشترک Prefer merge می‌فرستد)
    const res = await fetch(`${this.url}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: event.userId,
        action: event.action,
        entity_type: event.entityType ?? null,
        entity_id: event.entityId ?? null,
        details: event.details ?? {},
        source_ip: event.sourceIp ?? null,
      }),
    });
    if (!res.ok) {
      throw new Error(`Supabase POST audit_logs: ${res.status} ${await res.text()}`);
    }
  }

  async insertDailyQueueItems(userId: string, queueDate: string, items: DailyQueueItemRow[]): Promise<void> {
    if (items.length === 0) return;
    await this.request('POST', 'daily_queue_items', items.map((it) => ({
      user_id: userId,
      queue_date: queueDate,
      attempt_id: it.attemptId,
      question_id: it.questionId,
      node_id: it.nodeId ?? null,
      reason: it.reason,
      priority: it.priority ?? null,
      status: 'pending',
    })));
  }

  async countMasteryHistoryRows(userId: string): Promise<number> {
    const res = await fetch(
      `${this.url}/rest/v1/mastery_history?user_id=eq.${encodeURIComponent(userId)}&select=id`,
      {
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          Prefer: 'count=exact',
          Range: '0-0',
          RangeUnit: 'items',
        },
      },
    );
    if (!res.ok) return 0;
    const cr = res.headers.get('content-range'); // e.g. "0-0/17"
    const total = cr ? Number(cr.split('/')[1]) : 0;
    await res.text();
    return Number.isFinite(total) ? total : 0;
  }

  async listMasteryHistorySince(userId: string, sinceIso: string): Promise<MasteryHistoryRow[]> {
    const params = new URLSearchParams({
      user_id: `eq.${userId}`,
      recorded_at: `gte.${sinceIso}`,
      select: 'node_id,previous_score,new_score,change_reason,recorded_at',
      order: 'recorded_at.asc',
      limit: '5000',
    });
    const res = await fetch(`${this.url}/rest/v1/mastery_history?${params.toString()}`, {
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
      },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Record<string, unknown>[];
    return rows.map((row) => ({
      nodeId: String(row.node_id),
      previousScore: row.previous_score == null ? null : Number(row.previous_score),
      newScore: Number(row.new_score),
      changeReason: String(row.change_reason),
      recordedAt: String(row.recorded_at),
    }));
  }

  /* ---------- §8.7 — جلسهٔ شبیه‌سازی آزمون ---------- */

  private toExamSimulationSession(row: Record<string, unknown>): ExamSimulationSessionRow {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      level: String(row.level),
      examYear: Number(row.exam_year),
      subGroupId: String(row.sub_group_id),
      bookletCode: String(row.booklet_code),
      status: String(row.status) as ExamSimulationSessionStatus,
      plan: row.plan_snapshot ?? null,
      disclosures: Array.isArray(row.disclosures) ? (row.disclosures as string[]) : [],
      startedAt: String(row.started_at),
      expiresAt: String(row.expires_at),
      submittedAt: row.submitted_at == null ? null : String(row.submitted_at),
      report: row.report ?? null,
    };
  }

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
  }): Promise<ExamSimulationSessionRow> {
    const rows = (await this.request('POST', 'exam_sessions', {
      user_id: input.userId,
      level: input.level,
      exam_year: input.examYear,
      sub_group_id: input.subGroupId,
      booklet_code: input.bookletCode,
      status: 'active',
      plan_snapshot: input.plan,
      disclosures: input.disclosures,
      expires_at: input.expiresAt,
    })) as Record<string, unknown>[] | null;
    const session = this.toExamSimulationSession(rows?.[0] ?? {});
    try {
      if (input.items.length > 0) {
        await this.request(
          'POST',
          'exam_session_items',
          input.items.map((item) => ({
            session_id: session.id,
            question_id: item.questionId,
            section_id: item.sectionId,
            question_number: item.questionNumber,
            attempt_id: item.attemptId,
          })),
        );
      }
    } catch (error) {
      // fail-closed: جلسهٔ نیمه‌ساخته نباید به‌عنوان جلسهٔ فعال باقی بماند
      await this.request('PATCH', `exam_sessions?id=eq.${encodeURIComponent(session.id)}`, {
        status: 'submitted',
      }).catch(() => undefined);
      throw error;
    }
    return session;
  }

  async getExamSimulationSession(userId: string, sessionId: string): Promise<ExamSimulationSessionRow | null> {
    const rows = (await this.request(
      'GET',
      'exam_sessions',
      undefined,
      `?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
    )) as Record<string, unknown>[] | null;
    const row = rows?.[0];
    return row ? this.toExamSimulationSession(row) : null;
  }

  async listExamSimulationItems(sessionId: string): Promise<ExamSimulationItemRow[]> {
    const rows = (await this.request(
      'GET',
      'exam_session_items',
      undefined,
      `?session_id=eq.${encodeURIComponent(sessionId)}&select=*&order=question_number.asc`,
    )) as {
      session_id: string;
      question_id: string;
      section_id: string;
      question_number: number;
      attempt_id: string;
    }[] | null;
    return (rows ?? []).map((r) => ({
      sessionId: r.session_id,
      questionId: r.question_id,
      sectionId: r.section_id,
      questionNumber: Number(r.question_number),
      attemptId: r.attempt_id,
    }));
  }

  async recordExamSimulationResponse(input: {
    userId: string;
    sessionId: string;
    attemptId: string;
    questionId: string;
    selectedOption: number;
    responseTimeMs?: number | null;
  }): Promise<void> {
    // RPC امن: بلیت exam_simulation مصرف می‌شود و درستی سمت سرور محاسبه می‌گردد
    // (نتیجهٔ درستی به کلاینت برنمی‌گردد؛ فقط پس از ارسال جلسه در گزارش می‌آید)
    await this.request('POST', 'rpc/record_exam_simulation_response_idempotent', {
      p_user_id: input.userId,
      p_session_id: input.sessionId,
      p_attempt_id: input.attemptId,
      p_question_id: input.questionId,
      p_selected_option: input.selectedOption,
      p_response_time_ms: input.responseTimeMs ?? null,
    });
  }

  async listExamSimulationResponses(sessionId: string): Promise<ExamSimulationResponseRow[]> {
    const rows = (await this.request(
      'GET',
      'exam_session_responses',
      undefined,
      `?session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
    )) as {
      session_id: string;
      question_id: string;
      selected_option: number;
      is_correct: boolean;
      response_time_ms: number | null;
      answered_at: string;
    }[] | null;
    return (rows ?? []).map((r) => ({
      sessionId: r.session_id,
      questionId: r.question_id,
      selectedOption: Number(r.selected_option),
      isCorrect: Boolean(r.is_correct),
      responseTimeMs: r.response_time_ms == null ? null : Number(r.response_time_ms),
      answeredAt: String(r.answered_at),
    }));
  }

  async beginExamSimulationSubmission(userId: string, sessionId: string): Promise<ExamSimulationSessionRow> {
    const row = await this.request('POST', 'rpc/begin_exam_simulation_submission', {
      p_user_id: userId, p_session_id: sessionId,
    });
    return this.toExamSimulationSession(row as Record<string, unknown>);
  }

  async submitExamSimulationSession(userId: string, sessionId: string, report: unknown): Promise<unknown> {
    return this.request('POST', 'rpc/finalize_exam_simulation_submission', {
      p_user_id: userId, p_session_id: sessionId, p_report: report,
    });
  }
}
