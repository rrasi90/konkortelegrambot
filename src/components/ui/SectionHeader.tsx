interface Props {
  title: string;
  accent?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, accent = 'var(--ael-accent-teal)', actionLabel, onAction }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 0 12px', minWidth: 0 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        {title}
      </h2>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{ fontSize: 11, color: accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
        >
          {actionLabel} ›
        </button>
      )}
    </div>
  );
}
