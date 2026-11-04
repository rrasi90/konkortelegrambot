import type { FC } from 'react';
import type { KnowledgeNode } from '../data/konkorData';
import { getNodeEffectiveBranchCoefficient, type LearnerSixDState, type MajorExamBranch, type UserStats } from '../engine/aelEngine';

interface KonkorScoreSimulatorCardProps {
  nodes: KnowledgeNode[];
  nodeStates: Record<string, LearnerSixDState>;
  stats: UserStats;
  onUpdateBranch?: (branch: MajorExamBranch) => void;
  onStartPracticeNode: (nodeId: string, mode: 'practice') => void;
  onOpenLessonNode: (nodeId: string) => void;
  onOpenPlacementModal?: () => void;
}

const BRANCH_LABELS: Record<MajorExamBranch, string> = {
  business: 'ارشد مدیریت بازرگانی',
  industrial: 'ارشد مدیریت صنعتی',
  technology: 'ارشد مدیریت تکنولوژی',
  phd_all: 'دکتری مدیریت',
};

export const KonkorScoreSimulatorCard: FC<KonkorScoreSimulatorCardProps> = ({
  nodes, nodeStates, stats, onUpdateBranch, onStartPracticeNode, onOpenLessonNode, onOpenPlacementModal,
}) => {
  const branch = stats.selectedMajorBranch ?? 'business';
  const topics = nodes.filter((node) => branch === 'phd_all' || getNodeEffectiveBranchCoefficient(node, branch) > 0);
  const mastery = (node: KnowledgeNode) => nodeStates[node.id]?.masteryScore ?? 0;
  const average = topics.reduce((sum, node) => sum + mastery(node), 0) / topics.length;
  const weakest = topics.reduce<KnowledgeNode | undefined>(
    (current, node) => !current || mastery(node) < mastery(current) ? node : current, undefined
  );

  return (
    <section className="bento-card glass-panel p-5 sm:p-6 space-y-4">
      <h2 className="text-base sm:text-lg font-bold">پیشرفت در مباحث آموزشی</h2>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BRANCH_LABELS) as MajorExamBranch[]).map((option) => (
          <button key={option} type="button" aria-pressed={branch === option}
            onClick={() => onUpdateBranch?.(option)}
            className="glass-subcard rounded-lg px-3 py-1.5 text-xs">
            {BRANCH_LABELS[option]}
          </button>
        ))}
      </div>
      <p className="font-bold">
        میانگین سادهٔ تسلط در {topics.length} مبحث نگاشت‌شده: {topics.length ? Math.round(average * 10) / 10 + '٪' : 'داده‌ای در دسترس نیست'}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        این میانگین بدون ضرایب آزمون محاسبه می‌شود.
        {branch === 'phd_all' && ' نگاشت مباحث به مواد و ضرایب رسمی دکتری هنوز تأیید نشده است.'}
      </p>
      {weakest && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>مبحث پیشنهادی برای مرور: {weakest.topic}</span>
          <button type="button" onClick={() => onOpenLessonNode(weakest.id)} className="glass-subcard rounded-lg px-3 py-1.5">درسنامه</button>
          <button type="button" onClick={() => onStartPracticeNode(weakest.id, 'practice')} className="glass-subcard rounded-lg px-3 py-1.5">تمرین</button>
        </div>
      )}
      {onOpenPlacementModal && (
        <button type="button" onClick={onOpenPlacementModal} className="glass-subcard rounded-lg px-3 py-1.5 text-xs">ارزیابی اولیه</button>
      )}
    </section>
  );
};
