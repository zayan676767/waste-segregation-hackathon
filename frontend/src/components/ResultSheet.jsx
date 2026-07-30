import { readableTextOn, tint } from '../lib/color.js';

/**
 * The result, presented as a sheet over the camera.
 *
 * This is where v2 earns the switch to Gemini: instead of "Rubber eraser →
 * Hazardous", it can say what the object actually is, what it is made of, and
 * how to dispose of THAT object. Every field here is per-item text the vision
 * model wrote for this photo, not category boilerplate.
 */
export default function ResultSheet({ result, photo, onDismiss, onScanAgain }) {
  if (!result) return null;

  if (result.status === 'no-item') {
    return (
      <Shell onDismiss={onDismiss}>
        <Emptyish
          icon="🔍"
          title="No item found"
          body="Point the camera at a single object and fill more of the frame. A plain background helps."
          onScanAgain={onScanAgain}
        />
      </Shell>
    );
  }

  if (result.status === 'unmapped' || !result.categoryName) {
    return (
      <Shell onDismiss={onDismiss}>
        <Emptyish
          icon="❓"
          title={result.itemName || 'Unrecognised item'}
          body={
            result.itemDescription ||
            "This doesn't match any of your categories yet. Add one in the Admin panel and scan again."
          }
          onScanAgain={onScanAgain}
        />
      </Shell>
    );
  }

  const color = result.categoryColor ?? '#94a3b8';
  const pct = Math.round((result.confidence ?? 0) * 100);
  const steps = splitSteps(result.disposalInstructions);

  return (
    <Shell onDismiss={onDismiss}>
      <div className="space-y-4">
        {/* Identity */}
        <div className="flex items-start gap-3.5">
          {photo && (
            <img
              src={photo}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-white/15"
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.35rem] font-bold leading-tight tracking-tight text-white">
              {result.itemName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: color, color: readableTextOn(color) }}
              >
                {result.categoryName}
              </span>
              {result.material && (
                <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-medium text-white/65">
                  {result.material}
                </span>
              )}
            </div>
          </div>
        </div>

        {result.itemDescription && (
          <p className="text-[0.95rem] leading-relaxed text-white/75">{result.itemDescription}</p>
        )}

        {/* Confidence — a slim inline bar, not a whole section */}
        <div className="flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: tint(color, 0.18) }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Identification confidence"
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-white/55">{pct}% sure</span>
        </div>

        {/* Disposal — the actionable part, given the most visual weight */}
        {steps.length > 0 && (
          <section
            className="rounded-2xl border p-4"
            style={{ borderColor: tint(color, 0.3), backgroundColor: tint(color, 0.08) }}
          >
            <h3 className="eyebrow text-[10px] font-bold text-white/50">How to dispose of this</h3>
            <ol className="mt-3 space-y-2.5">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className="animate-fade-up flex gap-3"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ backgroundColor: color, color: readableTextOn(color) }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-white/85">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {result.environmentalNote && (
          <section className="flex gap-3 rounded-2xl bg-white/5 p-4">
            <span className="text-lg" aria-hidden="true" style={{ animation: 'var(--animate-drift)' }}>
              🌍
            </span>
            <div className="min-w-0">
              <h3 className="eyebrow text-[10px] font-bold text-white/45">Did you know</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/75">
                {result.environmentalNote}
              </p>
            </div>
          </section>
        )}

        {result.engine === 'offline' && (
          <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/85">
            Identified on-device — the online model was unreachable, so detail is limited.
          </p>
        )}

        <button
          onClick={onScanAgain}
          className="min-h-13 w-full rounded-2xl bg-white py-3.5 text-base font-bold text-slate-900 transition active:scale-[0.98]"
        >
          Scan another item
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children, onDismiss }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        aria-label="Dismiss result"
        onClick={onDismiss}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <div
        className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] border-t border-white/12 bg-slate-950/95 px-5 pb-safe pt-3 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl"
        style={{ animation: 'var(--animate-sheet-up)' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

function Emptyish({ icon, title, body, onScanAgain }) {
  return (
    <div className="space-y-4 pb-2 text-center">
      <span className="block text-4xl" aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/60">{body}</p>
      <button
        onClick={onScanAgain}
        className="min-h-13 w-full rounded-2xl bg-white py-3.5 text-base font-bold text-slate-900 transition active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  );
}

/**
 * Gemini returns disposal advice as prose. Numbered steps read far better on a
 * phone, so this splits it into an array — falling back to the whole string
 * when it is a single instruction.
 *
 * The backend already strips any numbering Gemini adds on its own, but this
 * stays numbering-aware too rather than assuming that always happened (a
 * different backend version, a cached response, anything). Splitting on plain
 * sentence boundaries without checking for numbering first was the actual bug:
 * "1. Back up the device. 2. Remove the SIM." has a period-space-capital right
 * after "1", so a sentence-boundary split cuts "1." into its own row and
 * leaves the real text on the next one — a blank numbered circle followed by
 * an unnumbered line, exactly what showed up on screen.
 */
function splitSteps(text) {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Numbered-list shape first: "1. X 2) Y 3. Z" — split on the markers
  // themselves so the numeral is never separated from its own sentence.
  const numbered = trimmed
    .split(/(?:^|\s)\d{1,2}[.)]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered.slice(0, 6);

  // Otherwise split on sentence boundaries. Requiring a lowercase letter right
  // before the punctuation means "1." can never be mistaken for a sentence end
  // (a digit is never lowercase), so this no longer needs the numbered-list
  // check above to be perfect — it is a second, independent safeguard.
  const bySentence = trimmed
    .split(/(?<=[a-z][.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return bySentence.length > 1 ? bySentence.slice(0, 5) : [trimmed];
}
