import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChapterLearningUnit } from '../components/ChapterLearningUnit';
import { TopicDiagramVisualizer } from '../components/TopicDiagramVisualizer';
import { BOOK_CHAPTERS } from '../data/bookChaptersRepo';
import type { BookChapter } from '../data/bookChaptersTypes';

const pilot = Object.values(BOOK_CHAPTERS)
  .flat()
  .find((chapter) => chapter.id === 'ch.kotler.1');

describe('رندر واحد یادگیری فصل', () => {
  it('همهٔ بخش‌های داده‌دار فصل پایلوت را رندر می‌کند', () => {
    expect(pilot).toBeTruthy();
    const html = renderToStaticMarkup(
      React.createElement(ChapterLearningUnit, { chapter: pilot as BookChapter })
    );
    expect(html).toContain('خلاصهٔ تألیفی');
    expect(html).toContain('اهداف یادگیری');
    expect(html).toContain('پیش‌نیاز:');
    expect(html).toContain('قبل از خواندن، خودت را بسنج');
    expect(html).toContain('مثال حل‌شده:');
    expect(html).toContain('دام رایج:');
    expect(html).toContain('بعد از خواندن، بازیابی کن');
  });

  it('برای فصل بدون داده، بخش‌های خالی نمی‌سازد', () => {
    const empty: BookChapter = {
      id: 'ch.test.empty',
      number: '۱',
      title: 'فصل آزمایشی',
      examCount: 0,
      nodes: [],
      points: ['فقط یک نکته'],
    };
    const html = renderToStaticMarkup(React.createElement(ChapterLearningUnit, { chapter: empty }));
    expect(html).toContain('فقط نکات');
    expect(html).not.toContain('اهداف یادگیری');
    expect(html).not.toContain('مثال حل‌شده:');
    expect(html).not.toContain('بعد از خواندن، بازیابی کن');
  });
});

describe('نمودار مفهومی فصل‌ها', () => {
  // همان قرارداد BookLibraryView: nodeId گرهٔ فصل و topic عنوان + نکات
  const diagramHtml = (chapter: BookChapter) =>
    renderToStaticMarkup(
      React.createElement(TopicDiagramVisualizer, {
        nodeId: chapter.nodes[0] || '',
        topic: `${chapter.title} ${chapter.points.join(' ')}`,
      })
    );

  it('فصل «کانال توزیع» بازاریابی، نمودار توزیع نرمال آماری نمی‌گیرد', () => {
    const kotler8 = Object.values(BOOK_CHAPTERS)
      .flat()
      .find((item) => item.id === 'ch.kotler.8');
    expect(kotler8).toBeTruthy();
    expect(diagramHtml(kotler8 as BookChapter)).not.toContain('Normal Distribution');
  });

  it('فصل آماری «توزیع‌های گسسته و پیوسته» نمودار نرمال می‌گیرد', () => {
    const math8 = Object.values(BOOK_CHAPTERS)
      .flat()
      .find((item) => item.id === 'ch.math.8');
    expect(math8).toBeTruthy();
    expect(diagramHtml(math8 as BookChapter)).toContain('Normal Distribution');
  });
});
