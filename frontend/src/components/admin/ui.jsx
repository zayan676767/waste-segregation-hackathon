import { useState } from 'react';

/** Labelled form field with inline error text. */
export function Field({ label, hint, error, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-semibold eyebrow text-white/45">
        {label}
      </span>
      {children}
      {hint && !error && <span className="block text-xs text-white/35">{hint}</span>}
      {error && <span className="block text-xs font-medium text-red-300">{error}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-xl border bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:bg-white/8';

export function TextInput({ error, ...props }) {
  return (
    <input
      {...props}
      className={`${inputBase} ${
        error ? 'border-red-400/50 focus:border-red-400' : 'border-white/12 focus:border-white/35'
      }`}
    />
  );
}

export function TextArea({ error, rows = 3, ...props }) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={`${inputBase} resize-y leading-relaxed ${
        error ? 'border-red-400/50 focus:border-red-400' : 'border-white/12 focus:border-white/35'
      }`}
    />
  );
}

export function Select({ error, children, ...props }) {
  return (
    <select
      {...props}
      className={`${inputBase} appearance-none ${
        error ? 'border-red-400/50' : 'border-white/12 focus:border-white/35'
      }`}
    >
      {children}
    </select>
  );
}

const BUTTON_TONES = {
  primary: 'bg-white text-slate-900 hover:bg-white/90',
  ghost: 'border border-white/12 bg-white/5 text-white/80 hover:bg-white/10',
  danger: 'border border-red-400/35 bg-red-500/12 text-red-200 hover:bg-red-500/20'
};

export function Button({ tone = 'ghost', children, className = '', ...props }) {
  return (
    <button
      {...props}
      /* min-h-11 keeps every admin button at a thumb-friendly ~44px, since the
         panel may well be driven from the phone during a demo. */
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${BUTTON_TONES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Two-step destructive action. Every delete in this panel is irreversible and
 * some cascade, so nothing destructive is ever one click away.
 */
export function ConfirmButton({ label = 'Delete', confirmLabel = 'Confirm', warning, onConfirm, disabled }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button tone="danger" onClick={() => setArmed(true)} disabled={disabled}>
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3">
      {warning && <p className="text-xs leading-relaxed text-red-100/85">{warning}</p>}
      <div className="flex gap-2">
        <Button
          tone="danger"
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button onClick={() => setArmed(false)}>Cancel</Button>
      </div>
    </div>
  );
}

/** Short-lived success/error banner. */
export function Flash({ flash }) {
  if (!flash) return null;
  const ok = flash.tone !== 'error';
  return (
    <div
      className={`animate-fade-up rounded-xl border px-3 py-2 text-sm font-medium ${
        ok
          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
          : 'border-red-400/30 bg-red-500/10 text-red-200'
      }`}
      role="status"
      aria-live="polite"
    >
      {flash.message}
    </div>
  );
}

export function SectionCard({ title, description, action, children }) {
  return (
    <section className="panel space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-white/45">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
