'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Shared open/close + placement for the small hover/tap popovers (InfoTooltip, Term).
// The popover is position: fixed and clamped to the viewport, so one opened next to
// the screen edge on a phone isn't cut off; it closes on scroll or a tap elsewhere.

const MARGIN = 8;

export function usePopover(maxWidth: number) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const open = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(maxWidth, vw - 2 * MARGIN);
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, MARGIN), vw - width - MARGIN);
    setPos({ top: r.bottom + 6, left, width });
  }, [maxWidth]);

  const close = useCallback(() => setPos(null), []);
  const toggle = useCallback(() => (pos ? close() : open()), [pos, open, close]);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) close();
    };
    window.addEventListener('scroll', close, true);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [pos, close]);

  return { anchorRef, pos, open, close, toggle };
}

export const popoverStyle = (pos: { top: number; left: number; width: number }): React.CSSProperties => ({
  position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000,
  background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8,
  padding: '10px 13px', fontSize: 12, fontWeight: 400, lineHeight: 1.6, color: 'var(--text-primary)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.14)', pointerEvents: 'none',
  textTransform: 'none', letterSpacing: 'normal', textAlign: 'left', whiteSpace: 'normal', fontStyle: 'normal',
});
