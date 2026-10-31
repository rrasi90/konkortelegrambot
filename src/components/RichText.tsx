import React from 'react';
import { MathText } from './MathText';

interface RichTextProps {
  text: string;
  className?: string;
}

/**
 * متن آموزشی با پشتیبانی از **تأکید** و فرمول‌های $...$ / $$...$$ .
 * بخش‌های پاراگرافی با خط خالی از هم جدا می‌شوند.
 */
export const RichText: React.FC<RichTextProps> = ({ text, className = '' }) => {
  const paragraphs = text.split(/\n{2,}/);

  return (
    <span className={className}>
      {paragraphs.map((paragraph, pIdx) => {
        const segments = paragraph.split('**');
        return (
          <span key={pIdx} className={pIdx > 0 ? 'block mt-3' : 'block'}>
            {segments.map((segment, sIdx) =>
              sIdx % 2 === 1 ? (
                <strong key={sIdx} className="font-bold">
                  <MathText text={segment} />
                </strong>
              ) : (
                <MathText key={sIdx} text={segment} />
              )
            )}
          </span>
        );
      })}
    </span>
  );
};
