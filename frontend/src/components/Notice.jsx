const TONES = {
  error: {
    ring: 'border-red-400/25 bg-red-500/8',
    icon: 'bg-red-500/15 text-red-300',
    glyph: '!'
  },
  warn: {
    ring: 'border-amber-400/25 bg-amber-500/8',
    icon: 'bg-amber-500/15 text-amber-300',
    glyph: '!'
  },
  info: {
    ring: 'border-sky-400/25 bg-sky-500/8',
    icon: 'bg-sky-500/15 text-sky-300',
    glyph: 'i'
  }
};

/**
 * Every failure the user can hit is rendered through this, so problems always
 * appear on screen with a next step rather than only in the console.
 */
export default function Notice({ tone = 'info', title, message, hint, action, children }) {
  const t = TONES[tone] ?? TONES.info;

  return (
    <div className={`animate-fade-up rounded-2xl border p-4 ${t.ring}`} role="status">
      <div className="flex gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${t.icon}`}
          aria-hidden="true"
        >
          {t.glyph}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          {title && <p className="text-sm font-semibold text-white">{title}</p>}
          {message && <p className="text-sm leading-relaxed text-white/70">{message}</p>}
          {hint && <p className="text-xs leading-relaxed text-white/50">{hint}</p>}
          {children}
          {action && <div className="pt-1.5">{action}</div>}
        </div>
      </div>
    </div>
  );
}
