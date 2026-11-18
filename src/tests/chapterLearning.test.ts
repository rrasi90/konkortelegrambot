import { describe, expect, it } from 'vitest';
import { BOOK_CHAPTERS } from '../data/bookChaptersRepo';
import {
  CHAPTER_CONTENT_KIND_LABEL,
  getChapterContentKind,
} from '../data/bookChaptersTypes';

const allChapters = Object.values(BOOK_CHAPTERS).flat();
const pilotIds = ['ch.kotler.1', 'ch.th.1', 'ch.meh.1'];

describe('مدل یادگیری فصل', () => {
  it('هر فصل یک برچسب نوع محتوای صادقانه دارد', () => {
    expect(allChapters.length).toBeGreaterThan(0);
    for (const chapter of allChapters) {
      const kind = getChapterContentKind(chapter);
      expect(CHAPTER_CONTENT_KIND_LABEL[kind]).toBeTruthy();
    }
  });

  it('سه فصل پایلوت قالب کامل یادگیری دارند', () => {
    for (const id of pilotIds) {
      const chapter = allChapters.find((item) => item.id === id);
      expect(chapter, `فصل ${id} پیدا نشد`).toBeTruthy();
      expect(chapter?.contentKind).toBe('authored_summary');
      expect(chapter?.objectives?.length).toBeGreaterThan(0);
      expect(chapter?.objectives?.length).toBeLessThanOrEqual(3);
      expect(chapter?.prerequisites?.length).toBeGreaterThan(0);
      expect(chapter?.pretest?.length).toBeGreaterThan(0);
      expect(chapter?.workedExample?.steps.length).toBeGreaterThan(0);
      expect(chapter?.commonTrap?.length).toBeGreaterThan(10);
      expect(chapter?.retrievalPrompts?.length).toBeGreaterThan(0);
    }
  });

  it('هیچ فصل بیش از سه هدف قابل‌سنجش ندارد', () => {
    for (const chapter of allChapters) {
      expect(chapter.objectives?.length ?? 0).toBeLessThanOrEqual(3);
    }
  });

  it('برچسب متن کامل فقط برای محتوای کامل تعریف شده است', () => {
    expect(CHAPTER_CONTENT_KIND_LABEL.full_text).toBe('متن کامل');
    expect(CHAPTER_CONTENT_KIND_LABEL.authored_summary).toContain('تألیفی');
    expect(CHAPTER_CONTENT_KIND_LABEL.notes_only).toContain('نکات');
  });
});
