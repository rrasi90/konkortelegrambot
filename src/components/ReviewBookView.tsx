import React, { useState } from 'react';
import { BookOpen, Layers, PenLine } from 'lucide-react';
import { FlashcardStudyView } from './FlashcardStudyView';
import { BookFlipStudyView } from './BookFlipStudyView';
import { PersonalFlashcardsView } from './PersonalFlashcardsView';

type ReviewTab = 'review' | 'book' | 'mine';

const TABS: Array<{ id: ReviewTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'review', label: 'مرور', icon: Layers },
  { id: 'book', label: 'کتاب', icon: BookOpen },
  { id: 'mine', label: 'کارت‌های من', icon: PenLine },
];

export const ReviewBookView: React.FC<{
  onOpenLessonNode?: (nodeId: string) => void;
  onExit?: () => void;
}> = ({ onOpenLessonNode, onExit }) => {
  const [tab, setTab] = useState<ReviewTab>('review');
  return (
    <div>
      <div className="max-w-xl mx-auto mt-4 flex gap-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer transition-colors ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {item.label}
            </button>
          );
        })}
      </div>
      {tab === 'review' && <FlashcardStudyView onOpenLessonNode={onOpenLessonNode} onExit={onExit} />}
      {tab === 'book' && <BookFlipStudyView />}
      {tab === 'mine' && <PersonalFlashcardsView />}
    </div>
  );
};
