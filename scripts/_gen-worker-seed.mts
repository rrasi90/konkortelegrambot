/**
 * یک‌بارِ مولد: تبدیل محتوای گسترش دکتری (phdExpansionContent) به فرمت seed ورکر
 * برای رساندن محتوای جدید به مینی‌اپ زندهٔ تلگرام (worker memory/seed).
 * اجرا: npx tsx scripts/_gen-worker-seed.mts  → خروجی JSON در stdout
 */
import { PHD_EXPANSION_NODES, PHD_EXPANSION_QUESTIONS } from '../src/data/phdExpansionContent.ts';

const nodes = PHD_EXPANSION_NODES.map((n) => ({
  id: n.id,
  track: n.track,
  course: n.course,
  chapter: n.chapter,
  topic: n.topic,
}));

const questions = PHD_EXPANSION_QUESTIONS.map((q, i) => ({
  id: `phd-exp-${String(i + 1).padStart(3, '0')}`,
  nodeId: q.nodeId,
  examYear: q.examYear,
  text: q.text,
  options: q.options,
  correctOption: q.correctOption,
  explanation: `${q.explanation} (منبع مطالعه: ${q.sourceReference})`,
  trapNote: q.trapNote,
  isVerified: false,
}));

console.log(JSON.stringify({ nodes, questions }, null, 2));
