import { useEffect, useState } from 'react';

/**
 * Shown over the frozen frame while Gemini identifies the item.
 *
 * Gemini takes roughly 2-8 seconds in practice. A spinner for that long reads
 * as a stall, so this shows the work instead: a beam sweeping the captured
 * photo, corner brackets locking on, and status copy that advances through the
 * actual stages of the request. The stages are time-driven rather than real
 * progress events — a single HTTP call has no intermediate milestones to
 * report — but they are truthful about what the request is doing.
 *
 * The photo itself is shown crisp, never blurred. An earlier version applied a
 * 1px CSS blur plus heavy darken/desaturate, which read as a corrupted image
 * rather than an intentional effect — that combination sits in the worst zone:
 * too subtle to look like deliberate soft-focus, strong enough to introduce
 * visible edge artifacts on a compressed JPEG. Legibility here comes from a
 * gradient scrim and a frosted glass panel instead of filtering the photo.
 */
const STAGES = [
  { at: 0, label: 'Reading the image', hint: 'Looking at shape, colour and texture' },
  { at: 1100, label: 'Identifying the item', hint: 'Checking labels and materials' },
  { at: 2400, label: 'Working out the bin', hint: 'Matching it to your categories' },
  { at: 4000, label: 'Writing disposal steps', hint: 'Almost there' },
  { at: 7000, label: 'Still working', hint: 'Slow connection — hang on' }
];

export default function ScanningOverlay({ photo, accentColors = [] }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 120);
    return () => clearInterval(id);
  }, []);

  const stageIndex = STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);
  const stage = STAGES[stageIndex];

  return (
    <div className="absolute inset-0 z-20 overflow-hidden rounded-[inherit]">
      {photo && <img src={photo} alt="" aria-hidden="true" className="h-full w-full object-cover" />}

      {/* Gradient scrim for legibility — a solid darkening layer, not a filter
          on the photo, so the image itself stays sharp and clean. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/75" />

      {/* Sweeping beam — the "actively reading this" cue */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 h-28 -translate-y-1/2 mix-blend-screen"
          style={{
            animation: 'var(--animate-scan-beam)',
            background:
              'linear-gradient(to bottom, transparent, oklch(0.88 0.15 165 / 0.3), oklch(0.95 0.17 165 / 0.65), oklch(0.88 0.15 165 / 0.3), transparent)'
          }}
        />
      </div>

      {/* Corner brackets — a viewfinder "locking on" motif */}
      <div className="pointer-events-none absolute inset-5">
        {[
          'left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-2xl',
          'right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-2xl',
          'left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-2xl',
          'right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-2xl'
        ].map((position) => (
          <span
            key={position}
            className={`absolute h-9 w-9 border-emerald-300 drop-shadow-[0_0_6px_oklch(0.85_0.18_165/0.6)] ${position}`}
            style={{ animation: 'var(--animate-breathe)' }}
          />
        ))}
      </div>

      {/* Status — a frosted glass panel, matching the result sheet's language
          so the wait state and the answer feel like one continuous surface. */}
      <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/40 px-5 pb-6 pt-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className="absolute inset-0 rounded-full bg-emerald-400"
              style={{ animation: 'var(--animate-ring)' }}
            />
            <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <p key={stage.label} className="animate-fade-up text-base font-semibold text-white">
            {stage.label}
            <span className="inline-block w-6 text-left text-emerald-300">
              {'.'.repeat(1 + (Math.floor(elapsed / 400) % 3))}
            </span>
          </p>
        </div>
        <p key={stage.hint} className="animate-fade-up mt-1 text-sm text-white/55">
          {stage.hint}
        </p>

        {/* The category colours pulsing in sequence — a nod to what the model
            is choosing between, driven by the real category list. */}
        {accentColors.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            {accentColors.map((color, i) => (
              <span
                key={color + i}
                className="h-1.5 flex-1 rounded-full transition-opacity duration-300"
                style={{
                  backgroundColor: color,
                  opacity: Math.floor(elapsed / 450) % accentColors.length === i ? 1 : 0.22
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
