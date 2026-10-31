import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
  block?: boolean;
}

/**
 * Renders Persian text mixed with inline ($...$) or block ($$...$$) LaTeX formulas using KaTeX.
 */
export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  const parts = useMemo(() => {
    if (!text) return [];
    // Split by $$...$$ or $...$
    const regex = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g;
    const tokens = text.split(regex);
    return tokens.map((token, idx) => {
      if (token.startsWith('$$') && token.endsWith('$$')) {
        const formula = token.slice(2, -2);
        try {
          const html = katex.renderToString(formula, {
            displayMode: true,
            throwOnError: false,
          });
          return { key: idx, isMath: true, display: true, html };
        } catch {
          return { key: idx, isMath: false, display: false, content: token };
        }
      }
      if (token.startsWith('$') && token.endsWith('$')) {
        const formula = token.slice(1, -1);
        try {
          const html = katex.renderToString(formula, {
            displayMode: false,
            throwOnError: false,
          });
          return { key: idx, isMath: true, display: false, html };
        } catch {
          return { key: idx, isMath: false, display: false, content: token };
        }
      }
      return { key: idx, isMath: false, display: false, content: token };
    });
  }, [text]);

  return (
    <span className={className}>
      {parts.map((part) => {
        if (part.isMath && part.html) {
          return (
            <span
              key={part.key}
              dir="ltr"
              className={part.display ? 'block my-2 text-center overflow-x-auto' : 'inline-block mx-1 align-middle'}
              dangerouslySetInnerHTML={{ __html: part.html }}
            />
          );
        }
        return <React.Fragment key={part.key}>{part.content}</React.Fragment>;
      })}
    </span>
  );
};
