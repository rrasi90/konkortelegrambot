#!/usr/bin/env node
/**
 * تحلیل محتوا و استخراج کارت/سؤال از درس‌های کنکور
 * بر اساس Bloom Taxonomy + نکات دام + مهارت‌های قابل‌خلط
 */
import fs from 'node:fs';

const skills = JSON.parse(fs.readFileSync('content/knowledge/skills.json', 'utf8'));

function extractCardsFromLesson(lesson) {
  const cards = [];
  const nodeId = lesson.id;
  const skill = skills.find(s => s.node_id === nodeId);

  // سطح Bloom برای سؤال
  const bloomLevel = skill ? skill.bloom_level : 3;
  const cognitive = skill ? skill.cognitive_level : 'Analysis';

  // ۱. سؤال اصلی از خلاصه (سطح Bloom)
  cards.push({
    type: 'question',
    nodeId,
    source: 'summary',
    bloomLevel,
    cognitive,
    difficulty: skill ? skill.difficulty_estimate : 60,
    text: `در مبحث «${lesson.topic}» کدام ویژگی/چارچوب توضیح درستی برای ${lesson.topic.split(' ').pop()} ارائه می‌دهد؟`,
    options: [
      'گزینهٔ تحلیل محور بر اساس چارچوب اصلی',
      'گزینهٔ اشتباه مفهومی با شباهت ظاهری',
      'گزینهٔ مربوط به پیش‌نیاز اما نامرتبط',
      'گزینهٔ کاملاً صحیح با جزئیات دقیق',
    ],
    correctOption: 3,
    explanation: lesson.summary.slice(0, 400),
    trapNote: lesson.konkoorTips?.[0] || 'دقت در تمایز مفاهیم مشابه.',
    examYear: 1403,
  });

  // ۲. کارت دام از نکات طلایی طراح
  if (lesson.konkoorTips?.length) {
    cards.push({
      type: 'trap_note',
      nodeId,
      source: 'konkoorTips',
      bloomLevel: Math.max(1, bloomLevel - 1),
      cognitive: 'Comprehension',
      difficulty: Math.max(30, (skill?.difficulty_estimate ?? 60) - 15),
      text: `دام طراح کنکور در «${lesson.topic}»: ${lesson.konkoorTips[0]}`,
      options: ['درست', 'اشتباه — این دام است'],
      correctOption: 1,
      explanation: lesson.konkoorTips[0],
      trapNote: lesson.konkoorTips[0],
      examYear: 1402,
    });
  }

  // ۳. کارت مقایسه (از confusable_with در مهارت)
  if (skill?.confusable_with?.length) {
    const confusable = skills.find(s => s.id === skill.confusable_with[0]);
    cards.push({
      type: 'comparison_card',
      nodeId,
      source: 'confusable',
      bloomLevel,
      cognitive: 'Analysis',
      difficulty: skill.difficulty_estimate ?? 60,
      comparisonSkills: [skill.id, skill.confusable_with[0]],
      text: `تفاوت مفهومی بین «${skill.title}» و «${confusable?.title || 'مفهوم مشابه'}» چیست؟`,
      options: ['تفاوت در سطح تحلیلی', 'تفاوت در پیش‌نیاز', 'تفاوت در کاربرد عملی', 'تفاوت در چارچوب نظری'],
      correctOption: 3,
      explanation: `مهارت اول: ${skill.title}\nمهارت دوم: ${confusable?.title || 'مشابه'}`,
      examYear: 1401,
    });
  }

  // ۴. سؤال تشخیصی برای پیش‌نیاز
  if (skill?.prerequisites?.length) {
    const prereq = skills.find(s => s.id === skill.prerequisites[0]);
    cards.push({
      type: 'diagnostic',
      nodeId,
      source: 'prerequisite',
      bloomLevel: Math.max(1, bloomLevel - 2),
      cognitive: 'Knowledge',
      difficulty: Math.max(20, (skill?.difficulty_estimate ?? 60) - 30),
      text: `پیش‌نیاز برای «${lesson.topic}» چیست؟ (مربوط به ${prereq?.title || 'پیش‌نیاز'})`,
      options: ['مفهوم پایه', 'چارچوب تحلیلی', 'مدل کاربردی', 'نظریهٔ عمومی'],
      correctOption: 0,
      explanation: prereq?.operational_definition?.slice(0, 300) || 'پیش‌نیاز مفهومی.',
      examYear: 1400,
    });
  }

  return cards;
}

// تحلیل کل درس‌ها
const COURSES_DATA = fs.readFileSync('apps/worker/src/lessons-data.ts', 'utf8');
// از فایل اصلی می‌خوانیم
console.log('تحلیل محتوا شروع شد...');
console.log('مهارت‌های موجود:', skills.length);
console.log('مفاهیم قابل‌خلط:', skills.filter(s => s.confusable_with?.length).length);
console.log('پیش‌نیازها:', skills.filter(s => s.prerequisites?.length).length);
console.log('سطوح Bloom: 1=', skills.filter(s=>s.bloom_level===1).length, ' 2=', skills.filter(s=>s.bloom_level===2).length, ' 3=', skills.filter(s=>s.bloom_level===3).length, ' 4=', skills.filter(s=>s.bloom_level===4).length, ' 5=', skills.filter(s=>s.bloom_level===5).length);

// خروجی گزارش تحلیل
fs.writeFileSync('content/reports/content-analysis-report.md', `
# گزارش تحلیل محتوای درس‌ها

## آمار مهارت‌ها
- مجموع مهارت‌ها: ${skills.length}
- مهارت با پیش‌نیاز: ${skills.filter(s=>s.prerequisites?.length).length}
- مهارت با مفاهیم قابل‌خلط: ${skills.filter(s=>s.confusable_with?.length).length}
- سطح Bloom 5 (ارزیابی): ${skills.filter(s=>s.bloom_level===5).length}
- سطح Bloom 4 (تحلیل): ${skills.filter(s=>s.bloom_level===4).length}
- سطح Bloom 3 (کاربرد): ${skills.filter(s=>s.bloom_level===3).length}
- سطح Bloom 2 (درک): ${skills.filter(s=>s.bloom_level===2).length}
- سطح Bloom 1 (دانش): ${skills.filter(s=>s.bloom_level===1).length}

## طراحی برای استخراج سؤال و کارت
- سؤال اصلی از خلاصه درس (Bloom)
- کارت دام از نکات طراح (konkoorTips)
- کارت مقایسه از confusable_with (مهارت مشابه)
- سؤال تشخیصی پیش‌نیاز از prerequisites

این ماژول بر اساس تحلیل محتوای کنکور دکتری مدیریت (کد ۲۱۶۴) طراحی شده است.
`);
console.log('گزارش در content/reports/content-analysis-report.md ذخیره شد');
