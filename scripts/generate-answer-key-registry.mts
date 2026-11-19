/**
 * R-036 Remediation — مولد رجیستری کلید پاسخ سمت سرور.
 *
 * بانک‌های سؤال React (src/data/*) حاوی correctOption/explanation/trapNote هستند
 * و از طریق import استاتیک وارد Bundle کلاینت می‌شوند (R-036). این اسکریپت
 * همان بانک‌ها را می‌خواند و «فقط فیلدهای کلیدی» را در یک ماژول سمت سرور
 * (apps/worker/src/data/client-bank-keys.server.ts) تولید می‌کند که هرگز به
 * کلاینت import نمی‌شود — پایهٔ تحویل server-only (R-025 گام ۱).
 *
 * خروجی شامل مقادیر Canary است که در تست SEC-010 برای اثبات عدم‌ورود به Bundle
 * به‌کار می‌روند. اجرا: node --import tsx scripts/generate-answer-key-registry.mts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

interface ExtractedKey {
  id: string;
  bank: string;
  /** سؤال چهارگزینه‌ای: اندیس گزینه صحیح. conceptCheck: اندیس گزینه صحیح (۰ یا ۱). */
  correctOption: number;
  explanation: string;
  trapNote: string;
}

async function importBank(relPath: string) {
  const abs = path.resolve(relPath);
  return import(`${'file://'}${abs.split(path.sep).join('/')}`);
}

/** استخراج بازگشتی هر شیء شبیه QuestionItem از خروجی‌های صادرشدهٔ ماژول.
 * سه شکل شناخته‌شده: QuestionItem (text/explanation/trapNote)، RefBook
 * (questionText/detailedAnswer/konkorTrap) و conceptCheck درس‌ها
 * (prompt/correctIndex/explanation با کلید ترکیبی `${lessonId}#conceptCheck`). */
function collectFromValue(
  value: unknown,
  bank: string,
  out: Map<string, ExtractedKey>,
  seen: Set<unknown>,
  containerId: string | null = null,
): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectFromValue(item, bank, out, seen, containerId);
    return;
  }
  const record = value as Record<string, unknown>;
  const ownId = typeof record.id === 'string' && record.id.length > 0 ? record.id : containerId;
  const hasKey = typeof record.correctOption === 'number';
  const identityText = typeof record.text === 'string' ? record.text : typeof record.questionText === 'string' ? record.questionText : null;
  const hasIdentity = typeof record.id === 'string' && record.id.length > 0 && identityText !== null;
  if (hasKey && hasIdentity) {
    const id = record.id as string;
    const explanation = typeof record.explanation === 'string'
      ? record.explanation
      : typeof record.detailedAnswer === 'string' ? record.detailedAnswer : '';
    const trapNote = typeof record.trapNote === 'string'
      ? record.trapNote
      : typeof record.konkorTrap === 'string' ? record.konkorTrap : '';
    if (out.has(id)) {
      const prev = out.get(id)!;
      if (prev.correctOption !== record.correctOption) {
        throw new Error(`تضاد کلید برای شناسهٔ تکراری ${id} بین ${prev.bank} و ${bank}`);
      }
    } else {
      out.set(id, {
        id,
        bank,
        correctOption: record.correctOption as number,
        explanation,
        trapNote,
      });
    }
  }
  // conceptCheck درس‌ها: correctIndex + prompt — کلید ترکیبی از شناسهٔ درس والد
  if (typeof record.correctIndex === 'number' && typeof record.prompt === 'string' && ownId) {
    const ccId = `${ownId}#conceptCheck`;
    if (!out.has(ccId)) {
      out.set(ccId, {
        id: ccId,
        bank,
        correctOption: record.correctIndex as number,
        explanation: typeof record.explanation === 'string' ? record.explanation : '',
        trapNote: '',
      });
    }
  }
  for (const [childKey, v] of Object.entries(record)) {
    // Record<string, T> مثل INITIAL_INTERACTIVE_LESSONS: کلید رکورد، شناسهٔ والد است
    const childContainer = ownId ?? (typeof childKey === 'string' && childKey.length > 0 && v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Record<string, unknown>).id !== 'string' ? childKey : null);
    collectFromValue(v, bank, out, seen, childContainer);
  }
}

async function main(): Promise<void> {
  const banks: Array<[string, string]> = [
    ['konkorData', 'src/data/konkorData.ts'],
    ['yearlyKonkorExams', 'src/data/yearlyKonkorExams.ts'],
    ['phdExpansionContent', 'src/data/phdExpansionContent.ts'],
    ['referenceBooksRepo', 'src/data/referenceBooksRepo.ts'],
    ['comprehensiveCourseEncyclopedia', 'src/data/comprehensiveCourseEncyclopedia.ts'],
    ['bookChaptersRepo', 'src/data/bookChaptersRepo.ts'],
  ];

  const keys = new Map<string, ExtractedKey>();
  /** ترتیب رجیستری موجود حفظ می‌شود تا خروجی تازه فقط کلیدهای نو را اضافه کند. */
  const existingOrder = new Map<string, number>();

  // رجیستری موجود پایهٔ کار است: بانک‌های src/data پس از R-036 دیگر correctOption
  // ندارند، پس بازتولید بدون این پایه، کلیدهای تاریخی را پاک می‌کرد.
  const existingRegistryPath = path.resolve('apps/worker/src/data/client-bank-keys.server.ts');
  if (fs.existsSync(existingRegistryPath)) {
    for (const rawLine of fs.readFileSync(existingRegistryPath, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line.startsWith('{ id: ') || !line.endsWith('},')) continue;
      // ساختار رجیستری تک‌خطی و ثابت است؛ کلیدهای فیلد را به JSON استاندارد تبدیل می‌کنیم.
      const asJson = line
        .slice(0, -1)
        .replace(/([,\{]\s*)(id|bank|correctOption|explanation|trapNote): /g, '$1"$2": ');
      const entry = JSON.parse(asJson) as {
        id: string;
        bank: string;
        correctOption: number;
        explanation?: string;
        trapNote?: string;
      };
      if (!existingOrder.has(entry.id)) existingOrder.set(entry.id, existingOrder.size);
      keys.set(entry.id, {
        id: entry.id,
        bank: entry.bank,
        correctOption: entry.correctOption,
        explanation: entry.explanation ?? '',
        trapNote: entry.trapNote ?? '',
      });
    }
    console.log(`existing registry: ${keys.size} keys`);
  }

  // کلیدهای استخراج‌شده از بانک فقط وقتی اضافه می‌شوند که در رجیستری نباشند؛
  // رجیستری موجود مرجع تاریخی است و نباید با مشتق‌گیری دوباره بازنویسی شود.
  const fresh = new Map<string, ExtractedKey>();
  for (const [bank, rel] of banks) {
    const mod = await importBank(rel);
    const seen = new Set<unknown>();
    for (const exported of Object.values(mod)) collectFromValue(exported, bank, fresh, seen);
  }
  for (const [id, entry] of fresh) {
    if (!keys.has(id)) keys.set(id, entry);
  }

  // Canaryهای ماندگار برای SEC-010: رشته‌هایی که فقط در همین رجیستری سرور وجود
  // دارند و هیچ ارتباطی به سؤال واقعی ندارند؛ حضورشان در Bundle = نقض.
  const canaries = [
    {
      id: 'sec.canary.correct.0001',
      bank: 'security-canary',
      correctOption: 2,
      explanation: 'CANARY-EXPLANATION-R036-9f4c1a2b7d8e3f60',
      trapNote: 'CANARY-TRAPNOTE-R036-4e8d90a1c2b35f67',
    },
    {
      id: 'sec.canary.option.0002',
      bank: 'security-canary',
      correctOption: 0,
      explanation: 'CANARY-EXPLANATION-R036-a1b2c3d4e5f60718',
      trapNote: 'CANARY-TRAPNOTE-R036-b2c3d4e5f6071829',
    },
  ];
  for (const c of canaries) keys.set(c.id, c);

  // کلید سؤال‌های واردشده از متن دفترچه‌ها. این‌ها از شاهد کلید رسمی
  // (`content/exam-key-evidence`) ساخته می‌شوند و متن سؤال در src/data کلید ندارد (R-036).
  const archiveKeysPath = path.resolve('apps/worker/src/data/exam-archive-keys.json');
  if (fs.existsSync(archiveKeysPath)) {
    const archive = JSON.parse(fs.readFileSync(archiveKeysPath, 'utf8')) as {
      keys: Record<string, { correctOption: number; examYear: number; bookletQuestionNumber: number; source: string }>;
    };
    for (const [id, entry] of Object.entries(archive.keys)) {
      if (keys.has(id)) {
        throw new Error(`کلید تکراری برای سؤال واردشده: ${id}`);
      }
      keys.set(id, {
        id,
        bank: 'examArchiveImported',
        correctOption: entry.correctOption,
        explanation: `کلید رسمی بازیابی‌شدهٔ آزمون ارشد ${entry.examYear}، سؤال ${entry.bookletQuestionNumber} (${entry.source}).`,
        trapNote: '',
      });
    }
  }

  const orderOf = (id: string) => existingOrder.get(id) ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...keys.values()].sort((a, b) => {
    const delta = orderOf(a.id) - orderOf(b.id);
    if (delta !== 0) return delta;
    return a.id < b.id ? -1 : 1;
  });
  const byBank = new Map<string, number>();
  for (const k of sorted) byBank.set(k.bank, (byBank.get(k.bank) ?? 0) + 1);

  const body = `/**
 * SERVER-ONLY — این فایل هرگز نباید به Bundle کلاینت import شود (R-036/R-025).
 *
 * تولیدشده توسط scripts/generate-answer-key-registry.mts در ${new Date().toISOString()}
 * منبع حقیقت کلیدها همان بانک‌های src/data است؛ این فایل فقط کلید را نگه می‌دارد.
 * Canaryها برای تست SEC-010 (اسکن Bundle) به‌صورت ثابت تولید می‌شوند.
 *
 * DO NOT EDIT BY HAND — regenerate.
 */

export interface ClientBankAnswerKey {
  id: string;
  bank: string;
  correctOption: number;
  explanation: string;
  trapNote: string;
}

/** شناسه‌های Canary برای اسکن Bundle (SEC-010). */
export const SECURITY_CANARY_IDS = ${JSON.stringify(canaries.map((c) => c.id))} as const;

export const CLIENT_BANK_ANSWER_KEYS: readonly ClientBankAnswerKey[] = [
${sorted.map((k) => `  { id: ${JSON.stringify(k.id)}, bank: ${JSON.stringify(k.bank)}, correctOption: ${k.correctOption}, explanation: ${JSON.stringify(k.explanation)}, trapNote: ${JSON.stringify(k.trapNote)} },`).join('\n')}
];

export const CLIENT_BANK_ANSWER_KEY_BY_ID: ReadonlyMap<string, ClientBankAnswerKey> =
  new Map(CLIENT_BANK_ANSWER_KEYS.map((k) => [k.id, k]));
`;

  const outDir = path.resolve('apps/worker/src/data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'client-bank-keys.server.ts');
  fs.writeFileSync(outPath, body, 'utf8');
  const sha = createHash('sha256').update(body).digest('hex');

  const manifest = {
    generatedAt: new Date().toISOString(),
    registryPath: 'apps/worker/src/data/client-bank-keys.server.ts',
    registrySha256: sha,
    totalKeys: sorted.length,
    perBank: Object.fromEntries(byBank),
    canaryIds: canaries.map((c) => c.id),
    banks: banks.map(([bank, rel]) => ({ bank, sourcePath: rel })),
  };
  fs.writeFileSync(
    path.resolve('apps/worker/src/data/client-bank-keys.manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );

  console.log(`registry generated: ${sorted.length} keys (${[...byBank].map(([b, n]) => `${b}=${n}`).join(', ')})`);
  console.log(`sha256: ${sha}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
