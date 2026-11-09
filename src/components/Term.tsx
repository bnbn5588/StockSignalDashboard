'use client';

import { GLOSSARY } from '@/lib/glossary';
import { useLang } from '@/lib/i18n';
import { usePopover, popoverStyle } from '@/lib/usePopover';

/** A word with a dotted underline that shows its glossary definition on hover/tap. */
export default function Term({ id, children }: { id: keyof typeof GLOSSARY | string; children: React.ReactNode }) {
  const { lang } = useLang();
  const { anchorRef, pos, open, close, toggle } = usePopover(260);
  const def = GLOSSARY[id];
  if (!def) return <>{children}</>;
  return (
    <span
      ref={anchorRef}
      onMouseEnter={open}
      onMouseLeave={close}
      onClick={e => { e.stopPropagation(); toggle(); }}
      style={{ borderBottom: '1px dotted currentColor', cursor: 'help' }}
    >
      {children}
      {pos && <span role="tooltip" style={popoverStyle(pos)}>{def[lang]}</span>}
    </span>
  );
}
