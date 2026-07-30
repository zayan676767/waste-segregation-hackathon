import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppData } from '../lib/useAppData.js';
import CategoryEditor from '../components/admin/CategoryEditor.jsx';
import SettingsEditor from '../components/admin/SettingsEditor.jsx';
import KeywordEditor from '../components/admin/KeywordEditor.jsx';
import ScanLog from '../components/admin/ScanLog.jsx';
import { Flash } from '../components/admin/ui.jsx';
import Notice from '../components/Notice.jsx';

const TABS = [
  { id: 'categories', label: 'Categories' },
  { id: 'settings', label: 'Settings' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'log', label: 'Scan log' }
];

export default function AdminPage() {
  const { categories, settings, mappings, status, error, reload } = useAppData();
  const [tab, setTab] = useState('categories');
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(null);

  const onFlash = useCallback((next) => {
    setFlash(next);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 3500);
  }, []);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  if (status === 'error') {
    return (
      <Notice
        tone="error"
        title="Cannot reach the backend"
        message={error}
        hint="Start it with npm run dev from the project root, then press Retry."
        action={
          <button
            onClick={reload}
            className="inline-flex min-h-11 items-center rounded-lg bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (status === 'loading') {
    return (
      <div className="space-y-3">
        <div className="skeleton h-11 rounded-2xl" />
        <div className="skeleton h-44 rounded-2xl" />
        <div className="skeleton h-44 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <nav
        role="tablist"
        aria-label="Admin sections"
        className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1.5 sm:grid-cols-4"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-all duration-200 ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-lg shadow-black/20'
                : 'text-white/55 hover:bg-white/5 hover:text-white/85'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <Flash flash={flash} />

      {tab === 'categories' && (
        <CategoryEditor categories={categories} mappings={mappings} onFlash={onFlash} />
      )}
      {tab === 'settings' && <SettingsEditor settings={settings} onFlash={onFlash} />}
      {tab === 'keywords' && (
        <KeywordEditor mappings={mappings} categories={categories} onFlash={onFlash} />
      )}
      {tab === 'log' && <ScanLog onFlash={onFlash} />}

      <p className="px-1 text-center text-[11px] leading-relaxed text-white/25">
        No login by design — this panel is for the demo operator. Every change broadcasts to
        connected phones and the dashboard immediately.
      </p>
    </div>
  );
}
