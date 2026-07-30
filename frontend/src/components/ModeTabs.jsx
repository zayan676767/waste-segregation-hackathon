const MODES = [
  { id: 'live', label: 'Live', hint: 'Continuous camera' },
  { id: 'snap', label: 'Pause & Snap', hint: 'Freeze one frame' },
  { id: 'sample', label: 'Samples', hint: 'No camera needed' }
];

/**
 * The three input paths, always visible as one row. Pause & Snap is the on-stage
 * fallback if live inference gets jittery, so it is a top-level tab rather than
 * something hidden behind a menu.
 */
export default function ModeTabs({ mode, onChange, disabled }) {
  return (
    <div
      role="tablist"
      aria-label="Input mode"
      className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1.5"
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={active}
            disabled={disabled && !active}
            onClick={() => onChange(m.id)}
            className={`rounded-xl px-2 py-2.5 text-center transition-all duration-200 disabled:opacity-40 ${
              active
                ? 'bg-white text-slate-900 shadow-lg shadow-black/20'
                : 'text-white/60 hover:bg-white/5 hover:text-white/90'
            }`}
          >
            <span className="block text-sm font-semibold leading-tight">{m.label}</span>
            <span
              className={`mt-0.5 block text-[10px] leading-tight ${
                active ? 'text-slate-500' : 'text-white/35'
              }`}
            >
              {m.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
