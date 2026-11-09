'use client';

import { useState } from 'react';
import { GLOSSARY } from '@/lib/glossary';
import { useLang } from '@/lib/i18n';

/** A word with a dotted underline that shows its glossary definition on hover/tap. */
export default function Term({ id, children }: { id: keyof typeof GLOSSARY | string; children: React.ReactNode }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const def = GLOSSARY[id];
  if (!def) return <>{children}</>;
  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
      style={{ position: 'relative', borderBottom: '1px dotted currentColor', cursor: 'help' }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000,
            width: 260, padding: '9px 12px', borderRadius: 8,
            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.14)', pointerEvents: 'none',
            fontSize: 12, fontWeight: 400, lineHeight: 1.6, color: 'var(--text-primary)',
            textTransform: 'none', letterSpacing: 'normal', textAlign: 'left', whiteSpace: 'normal',
          }}
        >
          {def[lang]}
        </span>
      )}
    </span>
  );
}
