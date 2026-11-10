/**
 * نسخهٔ Offline — مأموریت v4 §3.5
 *
 * سیاست محصول: این فایل فقط ابزار «مطالعه و مرور» محتوای عمومی است.
 *  - هیچ کلید پاسخ در این باندل وجود ندارد (Projection عمومی).
 *  - هیچ تصحیح، نمره، Mastery یا Rank در آفلاین انجام نمی‌شود.
 *  - پاسخ کاربر صرفاً به‌عنوان «پاسخ شخصی» محلی ذخیره می‌شود با وضعیت
 *    offline_unverified و هیچ اثری روی تسلط سروری ندارد.
 *  - پشتیبان نسخه‌های قبلی: فقط سابقهٔ مطالعه/نکات بازیابی می‌شود؛
 *    نتایج تمرین قدیمی بدون تصحیح معتبر، unverified_legacy_result تلقی و
 *    به‌عنوان نمره نمایش داده نمی‌شوند.
 */

import { offlineCourses, type PublicOfflineCourse, type PublicOfflineQuestion } from './offline-payload';

const STATE_KEY = 'ael_offline_state_v2';

interface OfflineState {
  format: 'ael-offline-state';
  version: 2;
  /** پاسخ‌های شخصی کاربر: questionId → index انتخابی (بدون تصحیح) */
  personalAnswers: Record<string, number | null>;
  /** سابقهٔ مطالعهٔ موضوع‌ها */
  studied: string[];
  /** نکتهٔ شخصی روی سؤال */
  issues: Record<string, string>;
}

interface LegacyBackupState {
  format?: unknown;
  version?: unknown;
  state?: {
    studied?: unknown;
    reviews?: unknown;
    issues?: unknown;
    personalAnswers?: unknown;
    results?: unknown;
    active?: unknown;
  };
}

function readState(): OfflineState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OfflineState;
      if (parsed && parsed.format === 'ael-offline-state' && parsed.version === 2 &&
          typeof parsed.personalAnswers === 'object' && parsed.personalAnswers !== null &&
          Array.isArray(parsed.studied) && typeof parsed.issues === 'object' && parsed.issues !== null) {
        return parsed;
      }
    }
  } catch { /* storage unavailable — stateless session */ }
  return { format: 'ael-offline-state', version: 2, personalAnswers: {}, studied: [], issues: {} };
}

function writeState(state: OfflineState): void {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

let state = readState();

const topicById = new Map<string, { course: PublicOfflineCourse; title: string }>();
for (const course of offlineCourses) {
  for (const topic of course.topics) topicById.set(topic.id, { course, title: topic.title });
}
const questionsById = new Map<string, PublicOfflineQuestion>();
for (const course of offlineCourses) {
  for (const question of course.questions) questionsById.set(question.id, question);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function courseOfQuestion(question: PublicOfflineQuestion): PublicOfflineCourse | undefined {
  return offlineCourses.find((course) => course.topics.some((topic) => topic.id === question.topicId));
}

function renderHeader(root: HTMLElement, title: string, onBack: (() => void) | null): void {
  const header = el('div', 'ael-off-header');
  header.appendChild(el('strong', undefined, title));
  if (onBack) {
    const back = el('button', 'ael-off-back', '← بازگشت');
    back.type = 'button';
    back.addEventListener('click', () => { tmaGuard(); onBack(); });
    header.appendChild(back);
  }
  root.appendChild(header);
  const banner = el('div', 'ael-off-banner',
    'نسخهٔ آفلاین فقط برای مطالعه و مرور است — بدون تصحیح، نمره یا تسلط. تصحیح و نتیجهٔ معتبر فقط در نسخهٔ آنلاین (سرور) انجام می‌شود.');
  banner.setAttribute('role', 'note');
  root.appendChild(banner);
}

/** هر تعامل پس از یک action را persist می‌کند (بدون تصحیح، بدون نمره). */
function tmaGuard(): void { /* hook placeholder — keeps call sites uniform */ }

function renderCourseList(root: HTMLElement): void {
  root.innerHTML = '';
  renderHeader(root, 'مطالعهٔ آفلاین — فهرست درس‌ها', null);
  for (const course of offlineCourses) {
    const card = el('button', 'ael-off-card');
    card.type = 'button';
    const left = el('div');
    left.appendChild(el('div', 'ael-off-title', course.title));
    left.appendChild(el('div', 'ael-off-meta', `${course.topics.length} مبحث · ${course.questions.length} سؤال`));
    const status = el('span', 'ael-off-chip', course.status === 'authored_pilot' ? 'مطالعهٔ عمومی' : course.status);
    card.appendChild(left);
    card.appendChild(status);
    card.addEventListener('click', () => renderTopicList(root, course));
    root.appendChild(card);
  }
  const backupRow = el('div', 'ael-off-backup');
  const exportBtn = el('button', 'ael-off-btn', 'دانلود پشتیبان مطالعه');
  exportBtn.type = 'button';
  exportBtn.addEventListener('click', () => exportBackup());
  const importLabel = el('label', 'ael-off-btn');
  importLabel.textContent = 'بازیابی پشتیبان';
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.style.display = 'none';
  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (file) void importBackup(file, root);
    importInput.value = '';
  });
  importLabel.appendChild(importInput);
  backupRow.appendChild(exportBtn);
  backupRow.appendChild(importLabel);
  root.appendChild(backupRow);
}

function renderTopicList(root: HTMLElement, course: PublicOfflineCourse): void {
  root.innerHTML = '';
  renderHeader(root, course.title, () => renderCourseList(root));
  root.appendChild(el('p', 'ael-off-desc', course.scopeNote || course.description));
  for (const topic of course.topics) {
    const count = course.questions.filter((question) => question.topicId === topic.id).length;
    if (count === 0) continue;
    const row = el('button', 'ael-off-card');
    row.type = 'button';
    row.appendChild(el('div', 'ael-off-title', topic.title));
    row.appendChild(el('span', 'ael-off-chip', `${count} سؤال`));
    row.addEventListener('click', () => renderQuestionList(root, course, topic.id));
    root.appendChild(row);
  }
}

function renderQuestionList(root: HTMLElement, course: PublicOfflineCourse, topicId: string): void {
  const topic = course.topics.find((item) => item.id === topicId);
  root.innerHTML = '';
  renderHeader(root, topic?.title ?? course.title, () => renderTopicList(root, course));
  const questions = course.questions.filter((question) => question.topicId === topicId);
  for (const question of questions) {
    root.appendChild(renderQuestionCard(question));
  }
}

function renderQuestionCard(question: PublicOfflineQuestion): HTMLElement {
  const card = el('article', 'ael-off-q');
  const head = el('div', 'ael-off-qhead');
  head.appendChild(el('span', 'ael-off-chip', question.review === 'reviewed' ? 'مرورشده' : 'در انتظار تأیید متخصص'));
  if (question.kind === 'essay') head.appendChild(el('span', 'ael-off-chip ael-off-essay', 'تشریحی'));
  card.appendChild(head);
  card.appendChild(el('p', 'ael-off-prompt', question.prompt));

  if (question.kind === 'essay') {
    const note = el('p', 'ael-off-note', 'پاسخ تشریحی در نسخهٔ آفلاین قابل ثبت و تصحیح نیست؛ در نسخهٔ آنلاین پاسخ دهید.');
    card.appendChild(note);
    return card;
  }

  const saved = state.personalAnswers[question.id];
  const options = el('div', 'ael-off-options');
  question.choices.forEach((choice, index) => {
    const option = el('button', 'ael-off-option');
    option.type = 'button';
    option.appendChild(el('span', 'ael-off-idx', `${index + 1}`));
    option.appendChild(el('span', undefined, choice));
    if (saved === index) option.classList.add('is-selected');
    option.addEventListener('click', () => {
      state.personalAnswers[question.id] = index;
      if (!state.studied.includes(question.topicId)) state.studied.push(question.topicId);
      writeState(state);
      options.querySelectorAll('.is-selected').forEach((node) => node.classList.remove('is-selected'));
      option.classList.add('is-selected');
      card.querySelectorAll('.ael-off-saved').forEach((node) => node.remove());
      const savedNote = el('p', 'ael-off-saved', 'پاسخ شخصی ذخیره شد (offline_unverified) — تصحیح فقط آنلاین.');
      card.appendChild(savedNote);
    });
    options.appendChild(option);
  });
  card.appendChild(options);
  if (saved !== undefined) {
    card.appendChild(el('p', 'ael-off-saved', 'پاسخ شخصی ذخیره شده (offline_unverified) — تصحیح فقط آنلاین.'));
  }
  const issueRow = el('div', 'ael-off-issue');
  const issueInput = el('input') as HTMLInputElement;
  issueInput.type = 'text';
  issueInput.placeholder = 'یادداشت شخصی روی این سؤال (اختیاری)';
  issueInput.maxLength = 500;
  issueInput.value = state.issues[question.id] ?? '';
  issueInput.addEventListener('change', () => {
    const value = issueInput.value.trim();
    if (value) state.issues[question.id] = value;
    else delete state.issues[question.id];
    writeState(state);
  });
  issueRow.appendChild(issueInput);
  card.appendChild(issueRow);
  return card;
}

function exportBackup(): void {
  const payload = {
    format: 'ael-offline-backup',
    version: 2,
    state: { personalAnswers: state.personalAnswers, studied: state.studied, issues: state.issues },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ael-offline-backup.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(file: File, root: HTMLElement): Promise<void> {
  const notice = el('div', 'ael-off-banner ael-off-banner-warn');
  let legacyResultsDiscarded = false;
  try {
    const parsed = JSON.parse(await file.text()) as LegacyBackupState;
    if (!parsed || typeof parsed !== 'object' || parsed.format !== 'ael-offline-backup' || !parsed.state) {
      throw new Error('ساختار فایل پشتیبان معتبر نیست.');
    }
    const raw = parsed.state;
    // سابقهٔ مطالعه فقط در برابر دادهٔ عمومی همین نسخه اعتبارسنجی می‌شود؛
    // هر رکورد ناشناخته حذف می‌شود تا دادهٔ دست‌کاری‌شده وارد حالت نشود.
    const studied = Array.isArray(raw.studied)
      ? raw.studied.filter((id): id is string => typeof id === 'string' && topicById.has(id))
      : [];
    const issues: Record<string, string> = {};
    if (raw.issues && typeof raw.issues === 'object' && !Array.isArray(raw.issues)) {
      for (const [id, note] of Object.entries(raw.issues as Record<string, unknown>)) {
        if (questionsById.has(id) && typeof note === 'string' && note.length <= 500) issues[id] = note;
      }
    }
    const personalAnswers: Record<string, number | null> = {};
    if (raw.personalAnswers && typeof raw.personalAnswers === 'object' && !Array.isArray(raw.personalAnswers)) {
      for (const [id, selected] of Object.entries(raw.personalAnswers as Record<string, unknown>)) {
        const question = questionsById.get(id);
        if (question && typeof selected === 'number' && Number.isInteger(selected) &&
            selected >= 0 && selected < question.choices.length) {
          personalAnswers[id] = selected;
        } else if (question && selected === null) {
          personalAnswers[id] = null;
        }
      }
    }
    // نتایج تمرین نسخه‌های قبلی: بدون تصحیح معتبر سمت سرور، مدرک نمره نیستند.
    if (raw.results !== undefined || raw.active !== undefined) legacyResultsDiscarded = true;

    state = { format: 'ael-offline-state', version: 2, personalAnswers, studied, issues };
    writeState(state);
    notice.textContent = legacyResultsDiscarded
      ? 'بازیابی انجام شد؛ سابقهٔ مطالعه و یادداشت‌ها برگشت. نتایج تمرین نسخهٔ قدیمی بدون تصحیح معتبر سرور، unverified_legacy_result تلقی و نادیده گرفته شد.'
      : 'بازیابی انجام شد؛ سابقهٔ مطالعه، یادداشت‌ها و پاسخ‌های شخصی برگشت (همگی offline_unverified).';
    notice.classList.add('ael-off-banner-warn');
    root.appendChild(notice);
    setTimeout(() => renderCourseList(root), 900);
  } catch (error) {
    notice.textContent = `بازیابی ناموفق بود: ${error instanceof Error ? error.message : 'فایل نامعتبر'}`;
    root.appendChild(notice);
  }
}

renderCourseList(document.getElementById('offline-root') as HTMLElement);
