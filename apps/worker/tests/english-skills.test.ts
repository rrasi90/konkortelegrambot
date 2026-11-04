import { beforeEach, describe, expect, it } from 'vitest';
import { ENGLISH_SKILLS } from '@ael/contracts';
import type { KnowledgeNode, Question } from '@ael/contracts';
import { createApp, resetRateLimitsForTesting } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import pack from '../../../content/examples/demo-pack.json';

const ENV = {
  ENVIRONMENT: 'development',
  SESSION_SECRET: 'test-secret',
  ALLOW_DEMO_AUTH: 'true',
};

let store: MemoryStore;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  // شمارندهٔ مشترک سطح isolate: هر تست از صفر شروع کند
  resetRateLimitsForTesting();
  store = new MemoryStore();
  store.nodes = pack.nodes.map((n) => ({ ...n })) as typeof store.nodes;
  store.dependencies = pack.dependencies.map((d) => ({ ...d })) as typeof store.dependencies;
  store.questions = pack.questions.map((q) => ({ ...q })) as typeof store.questions;
  app = createApp(ENV, { store });
});

async function login(): Promise<string> {
  const res = await app.request('/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'داوطلب زبان' }),
  });
  const body = (await res.json()) as { token: string };
  return body.token;
}

async function currentUser(token: string): Promise<string> {
  const res = await app.request('/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { user: { id: string } };
  return body.user.id;
}

async function fetchSkills(token: string): Promise<{ res: Response; payload: any }> {
  const res = await app.request('/api/english/skills', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { res, payload: (await res.json()) as any };
}

const englishNode = (id: string): KnowledgeNode => ({
  id,
  track: 'common',
  course: 'زبان انگلیسی',
  chapter: 'واژگان و ساختواژه',
  topic: 'واژگان آکادمیک در بافت',
});

const englishQuestion = (id: string, nodeId: string, examYear?: number): Question => ({
  id,
  nodeId,
  text: `سؤال زبان ${id}`,
  options: ['الف', 'ب', 'ج', 'د'],
  correctOption: 0,
  ...(examYear !== undefined ? { examYear } : {}),
});

describe('§8.8 — ماژول زبان انگلیسی (GET /api/english/skills)', () => {
  it('بدون احراز هویت رد می‌شود', async () => {
    const res = await app.request('/api/english/skills');
    expect(res.status).toBe(401);
  });

  it('تاکسونومی ۱۰ مهارت یکتا با پیش‌نیازهای موجود و شناسه‌های مجزا برمی‌گردد', async () => {
    const token = await login();
    const { res, payload } = await fetchSkills(token);
    expect(res.status).toBe(200);

    expect(payload.skillCount).toBe(10);
    expect(payload.skills).toHaveLength(10);
    expect(new Set(payload.skills.map((s: any) => s.id)).size).toBe(10);
    expect(new Set(payload.skills.map((s: any) => s.nodeId)).size).toBe(10);
    expect(payload.skills.map((s: any) => s.id)).toEqual(ENGLISH_SKILLS.map((s) => s.id));

    const ids = new Set(ENGLISH_SKILLS.map((s) => s.id));
    for (const skill of ENGLISH_SKILLS) {
      for (const prereq of skill.prerequisiteIds) {
        expect(ids.has(prereq)).toBe(true);
        expect(prereq).not.toBe(skill.id);
      }
      expect(skill.verification).toBe('proposed_curriculum_pending_sme');
    }
    expect(payload.taxonomy.status).toBe('proposed_curriculum_pending_sme');
  });

  it('بدون محتوای زبان: پوشش صفر و شکاف محتوا صریح اعلام می‌شود (بدون تسلط ساختگی)', async () => {
    const token = await login();
    const { res, payload } = await fetchSkills(token);
    expect(res.status).toBe(200);

    expect(payload.englishQuestionCount).toBe(0);
    expect(payload.assessableSkillCount).toBe(0);
    expect(payload.contentGap).toHaveLength(10);
    expect(payload.operational).toBe(false);
    for (const skill of payload.skills) {
      expect(skill.questionCount).toBe(0);
      expect(skill.nodePresent).toBe(false);
      expect(skill.assessed).toBe(false);
      expect(skill.mastery).toBeNull();
      expect(skill.evidenceCount).toBeNull();
    }
  });

  it('سؤال برچسب‌خوردهٔ مهارت شمرده می‌شود و سؤال قرنطینهٔ ۱۴۰۴ نه', async () => {
    store.nodes.push(englishNode('english.vocabulary_context'));
    store.questions.push(
      englishQuestion('en-q1', 'english.vocabulary_context', 1405),
      englishQuestion('en-q2', 'english.vocabulary_context', 1405),
      englishQuestion('en-quarantined', 'english.vocabulary_context', 1404),
    );
    const token = await login();
    const { res, payload } = await fetchSkills(token);
    expect(res.status).toBe(200);

    const vocab = payload.skills.find((s: any) => s.id === 'english.vocabulary_context');
    expect(vocab.nodePresent).toBe(true);
    expect(vocab.questionCount).toBe(2);
    expect(payload.englishQuestionCount).toBe(2);
    expect(payload.assessableSkillCount).toBe(1);
    expect(payload.contentGap).not.toContain('english.vocabulary_context');
    expect(payload.contentGap).toHaveLength(9);
    expect(payload.operational).toBe(false);
    // وجود سؤال به‌تنهایی تسلط نمی‌سازد
    expect(vocab.assessed).toBe(false);
    expect(vocab.mastery).toBeNull();
  });

  it('تسلط فقط با شاهد واقعی گزارش می‌شود و از مقدار پیش‌فرض ۵۰ نمی‌آید', async () => {
    store.nodes.push(englishNode('english.main_idea'));
    store.questions.push(englishQuestion('en-main', 'english.main_idea', 1405));
    const token = await login();
    const userId = await currentUser(token);

    store.mastery.set(`${userId}:english.main_idea`, {
      nodeId: 'english.main_idea',
      mastery: 72,
      status: 'learning',
    });

    const { res, payload } = await fetchSkills(token);
    expect(res.status).toBe(200);
    const main = payload.skills.find((s: any) => s.id === 'english.main_idea');
    expect(main.assessed).toBe(true);
    expect(main.mastery).toBe(72);

    const untouched = payload.skills.find((s: any) => s.id === 'english.reference');
    expect(untouched.assessed).toBe(false);
    expect(untouched.mastery).toBeNull();
  });

  it('وضعیت شش‌بعدی مهارت (شاهد و چرخهٔ پوشش) گزارش می‌شود', async () => {
    store.nodes.push(englishNode('english.inference_stance'));
    const token = await login();
    const userId = await currentUser(token);

    store.skillStates.set(`${userId}:english.inference_stance`, {
      skillId: 'english.inference_stance',
      proficiencyProbability: 0.6,
      confidence: 0.4,
      evidenceCount: 3,
      memoryRetrievability: 0.8,
      fluencySpeedRatio: 1.1,
      dominantErrorType: 'unknown',
      coverageStatus: 'learning',
      userId,
    });

    const { res, payload } = await fetchSkills(token);
    expect(res.status).toBe(200);
    const inference = payload.skills.find((s: any) => s.id === 'english.inference_stance');
    expect(inference.assessed).toBe(true);
    expect(inference.evidenceCount).toBe(3);
    expect(inference.coverageStatus).toBe('learning');
    expect(inference.mastery).toBeNull();
  });
});
