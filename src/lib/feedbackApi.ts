/**
 * پل گزارش محتوا، پیام به ادمین و یادآور.
 *
 * همان نشست تلگرام/دموی `serverGrading` استفاده می‌شود؛ هیچ شناسهٔ کاربری
 * از کلاینت فرستاده نمی‌شود. خطاها به پیام فارسی قابل‌نمایش تبدیل می‌شوند.
 */
import { authedFetch } from './serverGrading';
import type { ReminderSettings } from '../utils/studySettings';

export type ReportReason =
  | 'wrong_science'
  | 'typo'
  | 'unclear'
  | 'duplicate'
  | 'bad_source'
  | 'other';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  wrong_science: 'غلط علمی',
  typo: 'غلط تایپی',
  unclear: 'مبهم',
  duplicate: 'تکراری',
  bad_source: 'منبع نامعتبر',
  other: 'سایر',
};

export interface ContentReportInput {
  contentType: 'card' | 'lesson' | 'question';
  contentId: string;
  reason: ReportReason;
  details?: string;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || `خطای سرور ${response.status}`;
  } catch {
    return `خطای سرور ${response.status}`;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export async function sendContentReport(input: ContentReportInput): Promise<{ threadId: string }> {
  const detail = [
    'گزارش محتوا',
    `نوع: ${input.contentType}`,
    `شناسه: ${input.contentId}`,
    `دلیل: ${REPORT_REASON_LABELS[input.reason]}`,
    input.details?.trim() ? `توضیح: ${input.details.trim().slice(0, 500)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return postJson<{ threadId: string }>('/api/feedback', {
    category: 'content_issue',
    body: detail,
    relatedEntityType: input.contentType,
    relatedEntityId: input.contentId,
  });
}

export async function sendAdminMessage(body: string, category: 'general' | 'suggestion' | 'technical' = 'general'): Promise<{ threadId: string }> {
  return postJson<{ threadId: string }>('/api/feedback', {
    category,
    body: body.trim().slice(0, 4000),
  });
}

export interface ReminderPayload {
  reminder: ReminderSettings;
}

export async function saveReminderRemote(reminder: ReminderSettings): Promise<ReminderSettings> {
  const response = await authedFetch('/api/reminders', {
    method: 'PUT',
    body: JSON.stringify(reminder),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { reminder: ReminderSettings };
  return data.reminder;
}

export async function loadReminderRemote(): Promise<ReminderSettings | null> {
  const response = await authedFetch('/api/reminders', { method: 'GET' });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { reminder: ReminderSettings | null };
  return data.reminder;
}

export async function sendTestReminder(): Promise<void> {
  const response = await authedFetch('/api/reminders/test', { method: 'POST', body: '{}' });
  if (!response.ok) throw new Error(await readError(response));
}
