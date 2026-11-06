import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type Accent = 'teal' | 'blue' | 'purple' | 'green' | 'amber' | 'orange';
type Size = 'lg' | 'md' | 'sm';

interface AelCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  accent?: Accent;
  size?: Size;
  clickable?: boolean;
  as?: 'article' | 'button' | 'div' | 'a' | 'section';
  style?: CSSProperties;
}

const accentVar: Record<Accent, string> = {
  teal: 'var(--ael-accent-teal)',
  blue: 'var(--ael-accent-blue)',
  purple: 'var(--ael-accent-purple)',
  green: 'var(--ael-accent-green)',
  amber: 'var(--ael-accent-amber)',
  orange: 'var(--ael-accent-orange)',
};

export function AelCard({ children, accent = 'teal', size = 'md', clickable = false, as = 'article', style, className, ...rest }: AelCardProps) {
  const Tag = as as 'article';
  const radius = size === 'lg' ? 'var(--radius-card-lg)' : size === 'sm' ? 'var(--radius-card-sm)' : 'var(--radius-card-md)';
  const padding = size === 'lg' ? '20px' : size === 'sm' ? '14px' : '16px';
  return (
    <Tag
      className={className}
      data-accent={accent}
      style={{
        background: 'var(--ael-surface-primary)',
        border: '1px solid var(--ael-border-subtle)',
        borderRadius: radius,
        padding,
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
        minWidth: 0,
        ['--accent' as string]: accentVar[accent],
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
