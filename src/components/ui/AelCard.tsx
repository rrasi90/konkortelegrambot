import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type Accent = 'teal' | 'blue' | 'purple' | 'green' | 'amber' | 'orange';
type Size = 'lg' | 'md' | 'sm';
type Tag = 'article' | 'div' | 'section' | 'a' | 'button';

interface AelCardProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  children: ReactNode;
  accent?: Accent;
  size?: Size;
  /** فقط روی <a>/<button> یا با onClick=true */
  clickable?: boolean;
  as?: Tag;
  onClick?: () => void;
  href?: string;
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

/**
 * کارت پایهٔ AEL — همهٔ Variantها از این ارث می‌برند.
 * - کارت غیرتعاملی: as=article/div/section و بدون onClick → ظاهر کلیک ندارد (ael-card--static)
 * - کارت تعاملی: as=a/button یا clickable → Keyboard Accessible با focus-visible و role/button
 */
export function AelCard({ children, accent = 'teal', size = 'md', clickable = false, as, onClick, href, style, className, ...rest }: AelCardProps) {
  const tag: Tag = as ?? (href ? 'a' : onClick || clickable ? 'button' : 'article');
  const isInteractive = tag === 'a' || tag === 'button' || Boolean(onClick) || Boolean(clickable);
  const radius = size === 'lg' ? 'var(--radius-card-lg)' : size === 'sm' ? 'var(--radius-card-sm)' : 'var(--radius-card-md)';
  const padding = size === 'lg' ? '20px' : size === 'sm' ? '14px' : '16px';
  const TagEl = tag as 'article';

  const shared = {
    className: [className, 'ael-card', size === 'lg' ? 'ael-card--lg' : size === 'sm' ? 'ael-card--sm' : '', isInteractive ? 'ael-card--clickable' : 'ael-card--static'].filter(Boolean).join(' '),
    'data-accent': accent,
    style: {
      borderRadius: radius,
      padding,
      ['--accent' as string]: accentVar[accent],
      ...style,
    } as CSSProperties,
    ...(isInteractive && tag === 'div' ? ({ role: 'button', tabIndex: 0 } as const) : {}),
  };

  if (tag === 'a') {
    return (
      <a href={href} onClick={onClick} {...shared} {...rest}>
        {children}
      </a>
    );
  }
  if (tag === 'button') {
    return (
      <button type="button" onClick={onClick} {...shared} {...rest}>
        {children}
      </button>
    );
  }
  return (
    <TagEl onClick={onClick} {...shared} onKeyDown={isInteractive ? (e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(); } } : undefined} {...rest}>
      {children}
    </TagEl>
  );
}
