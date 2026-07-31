import { tint } from '../../lib/color.js';

/**
 * Category breakdown, built for a projector at the back of a room.
 *
 * Plain CSS bars rather than a chart engine, on purpose. The data is only ever
 * a handful of categories, and a charting library's vertical-layout Y axis
 * right-aligns the names (a ragged left edge) and drops any zero-count bar
 * entirely — which on a tall laptop panel left two categories as floating
 * labels with no bar. A hand-built row gives a tidy left-aligned name column,
 * a bar for every category including the empty ones, and pixel-identical
 * results on a phone and a laptop.
 *
 * Identity never depends on colour. Category colours are database values the
 * user can change to anything in admin, so every row carries its name in text
 * and its count as a number — colour is reinforcement, not the encoding.
 */
export default function CategoryBarChart({ data, total }) {
  if (!data?.length) return null;

  // The longest bar sets the scale. Floored at 1 so a set of all-zero counts
  // does not divide by zero and simply shows every bar at its minimum sliver.
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex h-full flex-col justify-center gap-3 lg:gap-4">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        // Every category keeps a visible sliver of its colour even at zero, so
        // the breakdown reads as complete rather than half-empty.
        const fill = Math.max(3, (d.count / max) * 100);

        return (
          <div key={d.categoryId ?? d.name} className="flex items-center gap-3 lg:gap-4">
            {/* Fixed-width, left-aligned name column — the tidy left edge. */}
            <span
              className="w-28 shrink-0 truncate text-[15px] font-semibold text-white/80 lg:w-40 lg:text-lg"
              title={d.name}
            >
              {d.name}
            </span>

            {/* Track + fill. The count rides at the right of the track. */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className="h-7 min-w-0 flex-1 overflow-hidden rounded-lg lg:h-9"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                role="progressbar"
                aria-valuenow={d.count}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={`${d.name}: ${d.count} ${d.count === 1 ? 'item' : 'items'}`}
              >
                <div
                  className="h-full rounded-lg transition-[width] duration-700 ease-out"
                  style={{
                    width: `${fill}%`,
                    backgroundColor: d.color,
                    boxShadow: d.count > 0 ? `0 0 16px ${tint(d.color, 0.6)}` : 'none'
                  }}
                />
              </div>

              <div className="flex w-16 shrink-0 items-baseline justify-end gap-1.5">
                <span className="text-xl font-black tabular-nums text-white lg:text-2xl">
                  {d.count}
                </span>
                {total > 0 && (
                  <span className="text-[11px] font-semibold tabular-nums text-white/35">
                    {pct}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
