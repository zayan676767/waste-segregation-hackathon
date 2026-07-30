import { LABEL_TRUST_THRESHOLD, prettyLabel } from '../lib/classifier.js';
import { readableTextOn, tint } from '../lib/color.js';

const SOURCE_LABELS = { live: 'Live camera', snap: 'Snapped frame', sample: 'Sample photo' };

/**
 * The hero element: what the item is, which bin it belongs in, how to dispose of
 * it, and why it matters.
 *
 * Every word and colour here comes from the database — the category name,
 * colour, disposal tip and impact line are all admin-editable, and the card
 * restyles itself the moment one changes.
 */
export default function ResultCard({ result, category, unsureMessage, busy }) {
  if (!result) return <EmptyState busy={busy} />;
  if (result.status === 'unsure') {
    return <UnsureState result={result} message={unsureMessage} />;
  }
  if (result.status === 'unmapped') return <UnmappedState result={result} />;

  const color = category?.color ?? '#94a3b8';
  const pct = Math.round(result.confidence * 100);

  // The model can be sure of the BIN while unsure of the exact object — a
  // battery sorts as Hazardous but its closest object guess is "rubber eraser",
  // because ImageNet has no battery class. Saying so is better than presenting a
  // rough guess as a confident identification.
  const looseLabel =
    result.labelConfidence !== undefined && result.labelConfidence < LABEL_TRUST_THRESHOLD;

  return (
    // Keyed on the category so the reveal animation fires when the verdict
    // actually changes — not on every 1.5s live tick, which would strobe.
    <div key={category?.id ?? 'unknown'} className="animate-pop-in space-y-3">
      <article
        className="relative overflow-hidden rounded-3xl border p-5"
        style={{
          borderColor: tint(color, 0.35),
          backgroundColor: tint(color, 0.09),
          boxShadow: `0 18px 50px -22px ${tint(color, 0.55)}`
        }}
      >
        {/* Colour wash so the card reads as its category at a glance. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full blur-3xl"
          style={{ backgroundColor: tint(color, 0.4) }}
        />

        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold eyebrow text-white/40">
                {looseLabel ? 'Closest visual match' : 'Detected item'}
              </p>
              <h2 className="mt-1 truncate text-2xl font-bold leading-tight text-white">
                {prettyLabel(result.label)}
              </h2>
            </div>

            <span
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold tracking-wide"
              style={{ backgroundColor: color, color: readableTextOn(color) }}
            >
              {category?.name ?? 'Unknown'}
            </span>
          </div>

          {looseLabel && (
            <p className="rounded-xl bg-white/6 px-3 py-2 text-xs leading-relaxed text-white/55">
              The item name is only a rough match — but the{' '}
              <span className="font-semibold text-white/80">
                {category?.name ?? 'category'}
              </span>{' '}
              classification is confident. Sort by the bin, not the name.
            </p>
          )}

          <ConfidenceBar pct={pct} color={color} />
        </div>
      </article>

      {category?.disposalTip && (
        <InfoPanel
          icon="🗑️"
          heading="How to dispose of this"
          body={category.disposalTip}
          accent={color}
          delay={90}
        />
      )}

      {category?.impactText && (
        <InfoPanel
          icon="🌍"
          heading="Environmental impact"
          body={category.impactText}
          accent={color}
          delay={170}
        />
      )}

      {result.source && (
        <p className="text-center text-[11px] text-white/30">
          {SOURCE_LABELS[result.source] ?? result.source}
        </p>
      )}
    </div>
  );
}

/**
 * Glides between values as confidence updates in live mode.
 *
 * The width is set directly rather than animated up from zero, deliberately.
 * Two earlier attempts — a requestAnimationFrame fill and a CSS scaleX
 * entrance — both left the bar rendering at 0 width whenever the frame clock
 * did not advance, silently misreporting the confidence. This bar carries real
 * information, so its resting style is always the true value; the reveal
 * animation lives on the card around it, where being decorative is safe.
 */
function ConfidenceBar({ pct, color }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold eyebrow text-white/40">
          Confidence
        </span>
        {/* tabular-nums stops the digits shifting width as the number changes. */}
        <span className="text-lg font-bold text-white tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full"
        style={{ backgroundColor: tint(color, 0.16) }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Classification confidence"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 12px ${tint(color, 0.75)}`
          }}
        />
      </div>
    </div>
  );
}

function InfoPanel({ icon, heading, body, accent, delay }) {
  return (
    <section
      className="panel flex gap-3 p-4"
      style={{ animation: 'var(--animate-fade-up)', animationDelay: `${delay}ms` }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
        style={{ backgroundColor: tint(accent, 0.16) }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 space-y-1">
        <h3 className="text-[10px] font-semibold eyebrow text-white/40">
          {heading}
        </h3>
        <p className="text-sm leading-relaxed text-white/80">{body}</p>
      </div>
    </section>
  );
}

/** Below the configured threshold: say so, rather than assert a wrong answer. */
function UnsureState({ result, message }) {
  const pct = Math.round(result.confidence * 100);

  return (
    <div
      key="unsure"
      className="animate-pop-in rounded-3xl border border-amber-400/30 bg-amber-500/8 p-5"
      style={{ boxShadow: '0 18px 50px -24px rgba(245, 158, 11, 0.45)' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/18 text-lg"
          aria-hidden="true"
        >
          🤔
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold eyebrow text-amber-300/70">
            Not confident enough
          </p>
          <h2 className="text-xl font-bold leading-snug text-white">{message}</h2>
          <p className="text-sm text-white/55">
            Closest guess was <span className="font-semibold text-white/80">
              {prettyLabel(result.label)}
            </span>{' '}
            at only {pct}%.
          </p>
          <ul className="space-y-1 pt-1 text-xs text-white/45">
            <li>• Move closer so the item fills the frame</li>
            <li>• Find brighter, even light and avoid harsh shadows</li>
            <li>• Use a plain background — one object at a time</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Recognised the object, but no keyword maps it to a category yet. */
function UnmappedState({ result }) {
  return (
    <div key="unmapped" className="animate-pop-in panel p-5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-lg"
          aria-hidden="true"
        >
          ❓
        </span>
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-semibold eyebrow text-white/35">
            Recognised, not categorised
          </p>
          <h2 className="text-xl font-bold text-white">{prettyLabel(result.label)}</h2>
          <p className="text-sm leading-relaxed text-white/55">
            No category keyword matches this yet. Add{' '}
            <span className="font-mono text-xs text-white/75">
              {result.label?.split(',')[0].toLowerCase()}
            </span>{' '}
            in the Admin panel and it will work immediately — no restart needed.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ busy }) {
  return (
    <div className="panel flex flex-col items-center gap-2 p-7 text-center">
      <span
        className={`text-3xl ${busy ? 'animate-breathe' : ''}`}
        aria-hidden="true"
      >
        {busy ? '⏳' : '📷'}
      </span>
      <p className="text-sm font-medium text-white/70">
        {busy ? 'Analysing…' : 'Ready to scan'}
      </p>
      <p className="max-w-[15rem] text-xs leading-relaxed text-white/40">
        {busy
          ? 'Running the classifier on this frame.'
          : 'Point the camera at a single item, or pick a sample photo.'}
      </p>
    </div>
  );
}
