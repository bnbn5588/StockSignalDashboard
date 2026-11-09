'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Two languages, strings kept inline at each call site as t('English', 'ไทย') so a
// label and its translation are edited together. The choice is remembered per
// browser; first visit follows the browser language.

export type Lang = 'en' | 'th';

const STORAGE_KEY = 'dashboard-lang';

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'en',
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
    if (saved === 'en' || saved === 'th') setLangState(saved);
    else if (navigator.language?.toLowerCase().startsWith('th')) setLangState('th');
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* storage blocked */ }
  }, []);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** t('English', 'ไทย') → the string for the current language. */
export function useT() {
  const { lang } = useLang();
  return useCallback((en: string, th: string) => (lang === 'th' ? th : en), [lang]);
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  const btn = (l: Lang, label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      style={{
        padding: '1px 8px', fontSize: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: lang === l ? 'var(--text-secondary)' : 'transparent',
        color: lang === l ? 'var(--bg-primary)' : 'var(--text-secondary)',
        fontWeight: lang === l ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
  return (
    <span style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: 5, overflow: 'hidden' }}>
      {btn('en', 'EN')}
      {btn('th', 'TH')}
    </span>
  );
}
