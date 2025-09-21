'use client';
import * as React from 'react';

import en from './en.json';
import fa from './fa.json';

type Messages = Record<string, any>;
const FALLBACK_LOCALE = 'en';
const PRESET: Record<string, Messages> = { en, fa };

function flatten(obj: any, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = String(v);
  }
  return out;
}

export type I18nContextValue = {
  locale: string;
  lang: string; // alias used by UI
  dir: 'ltr' | 'rtl';
  messages: Record<string, string>;
  t: (k: string, vars?: Record<string, string | number>) => string;
  announce: (text: string) => void;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  locale = FALLBACK_LOCALE,
  messages,
}: {
  children: React.ReactNode;
  locale?: string;
  messages?: Messages;
}) {
  const base = PRESET[locale] ?? PRESET[FALLBACK_LOCALE];
  const merged = React.useMemo(() => ({ ...flatten(base), ...(messages ? flatten(messages) : {}) }), [base, messages]);

  const [live, setLive] = React.useState('');
  const dir: 'ltr' | 'rtl' = /^fa/i.test(locale) ? 'rtl' : 'ltr';

  const ctx = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      lang: locale, // 👈 provide lang
      dir,
      messages: merged,
      t: (key, vars) => {
        const tpl = merged[key] ?? key;
        if (!vars) return tpl;
        return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(new RegExp(`{${k}}`, 'g'), String(v)), tpl);
      },
      announce: (text) => setLive(text),
    }),
    [locale, dir, merged],
  );

  return (
    <I18nContext.Provider value={ctx}>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {live}
      </span>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const v = React.useContext(I18nContext);
  if (!v) throw new Error('useI18n must be used within <I18nProvider>');
  return v;
}
export function useT() {
  return useI18n().t;
}
