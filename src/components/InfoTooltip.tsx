'use client';

import { usePopover, popoverStyle } from '@/lib/usePopover';

export default function InfoTooltip({ text }: { text: string }) {
  const { anchorRef, pos, open, close, toggle } = usePopover(280);

  return (
    <span
      ref={anchorRef}
      onMouseEnter={open}
      onMouseLeave={close}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 5 }}
    >
      <button
        onClick={e => { e.stopPropagation(); toggle(); }}
        aria-label="Explanation"
        aria-expanded={!!pos}
        style={{
          // 15px circle, with an invisible 8px ring of extra tap area for fingers
          width: 15,
          height: 15,
          boxSizing: 'content-box',
          padding: 0,
          margin: -8,
          border: '8px solid transparent',
          backgroundClip: 'padding-box',
          borderRadius: '50%',
          boxShadow: 'inset 0 0 0 1.5px var(--text-secondary)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 9,
          fontWeight: 700,
          fontStyle: 'italic',
          fontFamily: 'Georgia, serif',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          flexShrink: 0,
          opacity: 0.65,
        }}
      >
        i
      </button>
      {pos && <span role="tooltip" style={popoverStyle(pos)}>{text}</span>}
    </span>
  );
}
