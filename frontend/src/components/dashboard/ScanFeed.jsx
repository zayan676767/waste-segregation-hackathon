import { prettyLabel } from '../../lib/classifier.js';
import { tint } from '../../lib/color.js';

/**
 * Live event feed: "Plastic bottle → Recyclable (92%)".
 *
 * Newest first, so the eye lands on the freshest event without scrolling. The
 * newest row animates in; the rest stay still, because a list where everything
 * moves at once is unreadable on a projector.
 */
export default function ScanFeed({ scans }) {
  if (!scans.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <span className="text-4xl opacity-40" aria-hidden="true">
          📡
        </span>
        <p className="text-lg font-semibold text-white/70">Waiting for the first scan</p>
        <p className="max-w-xs text-sm text-white/40">
          Scans from any connected device appear here instantly.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {scans.map((scan, i) => (
        <FeedRow key={scan.id} scan={scan} isNewest={i === 0} />
      ))}
    </ul>
  );
}

function FeedRow({ scan, isNewest }) {
  const color = scan.categoryColor ?? '#94a3b8';
  const pct = Math.round((scan.confidence ?? 0) * 100);

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        isNewest ? 'animate-fade-up' : ''
      }`}
      style={{
        borderColor: tint(color, isNewest ? 0.4 : 0.16),
        backgroundColor: tint(color, isNewest ? 0.12 : 0.05)
      }}
    >
      <span
        className="h-8 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold leading-tight text-white">
          {prettyLabel(scan.label) || 'Unknown item'}
        </p>
        <p className="mt-0.5 truncate text-sm text-white/55">
          <span aria-hidden="true">→ </span>
          {scan.categoryName ?? 'Uncategorised'}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-lg font-bold tabular-nums text-white">{pct}%</p>
        <p className="text-[10px] eyebrow text-white/35">{scan.source}</p>
      </div>
    </li>
  );
}
