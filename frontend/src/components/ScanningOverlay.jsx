import { useEffect, useState } from 'react';

/**
 * Shown over the frozen frame while Gemini identifies the item.
 *
 * Gemini takes roughly 2-5 seconds. A spinner for that long reads as a stall, so
 * this shows the work instead: a beam sweeping the captured photo, corner
 * brackets locking on, and status copy that advances through the actual stages
 * of the request. The stages are time-driven rather than real progress events —
 * a single HTTP call has no intermediate milestones to report — but they are
 * truthful about what the request is doing, and they hold attention.
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

  const stageIndex = Math.max(
    0,
    STAGES.findLastIndex ? STAGES.findLastIndex((s) => elapsed >= s.at)
      : STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0)
  );
  const stage = STAGES[stageIndex];

  return (
    <div className="absolute inset-0 z-20 overflow-hidden rounded-[inherit]">
      {photo && (
        <img
          src={photo}
          alt=""
          aria-hidden="true"
          className="h-full w-full scale-105 object-cover blur-[1px] brightness-[0.55] saturate-[0.7]"
        />
      )}

      {/* Sweeping beam */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 h-24 -translate-y-1/2"
          style={{
            animation: 'var(--animate-scan-beam)',
            background:
              'linear-gradient(to bottom, transparent, oklch(0.9 0.14 165 / 0.35), oklch(0.95 0.16 165 / 0.75), oklch(0.9 0.14 165 / 0.35), transparent)'
          }}
        />
      </div>

      {/* Corner brackets — the "locking on" cue */}
      <div className="pointer-events-none absolute inset-5">
        {[
          'left-0 top-0 border-l-2 border-t-2 rounded-tl-xl',
          'right-0 top-0 border-r-2 border-t-2 rounded-tr-xl',
          'left-0 bottom-0 border-l-2 border-b-2 rounded-bl-xl',
          'right-0 bottom-0 border-r-2 border-b-2 rounded-br-xl'
        ].map((position) => (
          <span
            key={position}
            className={`absolute h-9 w-9 border-emerald-300/80 ${position}`}
            style={{ animation: 'var(--animate-breathe)' }}
          />
        ))}
      </div>

      {/* Status */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-5 pb-6 pt-14">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="absolute inset-0 rounded-full bg-emerald-400"
              style={{ animation: 'var(--animate-ring)' }}
            />
            <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <p
            key={stage.label}
            className="animate-fade-up text-base font-semibold text-white"
          >
            {stage.label}
            <span className="inline-block w-6 text-left text-emerald-300">
              {'.'.repeat(1 + (Math.floor(elapsed / 400) % 3))}
            </span>
          </p>
        </div>
        <p key={stage.hint} className="animate-fade-up mt-1 text-sm text-white/55">
          {stage.hint}
        </p>

        {/* The three category colours pulsing in sequence — a nod to what the
            model is choosing between, driven by the real category list. */}
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
