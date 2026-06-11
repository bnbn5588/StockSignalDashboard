'use client';

import { useRef, useState } from 'react';

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 5 }}
    >
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label="Chart explanation"
        style={{
          width: 15,
          height: 15,
          borderRadius: '50%',
          border: '1.5px solid var(--text-secondary)',
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
          padding: 0,
          flexShrink: 0,
          opacity: 0.65,
          transition: 'opacity 0.15s',
        }}
      >
        i
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '10px 13px',
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            width: 270,
            zIndex: 1000,
            boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}
