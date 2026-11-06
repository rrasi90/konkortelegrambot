import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(700px 320px at 85% -5%, rgba(54,196,189,0.09), transparent 70%), radial-gradient(500px 260px at 5% 30%, rgba(146,116,220,0.05), transparent 70%), linear-gradient(180deg, var(--app-bg), var(--app-bg-deep))',
        color: 'var(--ael-text-primary)',
      }}
    >
      <div className="mx-auto w-full" style={{ maxWidth: 1240, padding: '0 14px', paddingBottom: 120 }}>
        {children}
      </div>
    </div>
  );
}
