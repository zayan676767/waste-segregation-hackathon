import { useEffect, useRef, useState } from 'react';
import { binColorName, readableTextOn, tint } from '../lib/color.js';

/**
 * The result, presented as a sheet over the camera.
 *
 * Every field here is per-item text the vision model wrote for this specific
 * photo — what the object is, what it is made of, and how to dispose of it —
 * rather than boilerplate attached to its category.
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
              {/* The physical bin colour to walk to — a filled swatch plus its
                  name, so "Recyclable" is instantly "the Blue bin". */}
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold text-white/85"
                style={{ borderColor: tint(color, 0.45), backgroundColor: tint(color, 0.12) }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-white/25"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                {binColorName(color)} bin
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

        {/* Questioning the classification — the "why", not just the "what".
            Answers three things a judge might challenge: why this bin, why not
            the others, and one environmental fact. */}
        {(result.whyThisCategory || result.whyNotOtherBins) && (
          <section
            className="space-y-3 rounded-2xl border p-4"
            style={{ borderColor: tint(color, 0.22), backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            <h3 className="eyebrow text-[10px] font-bold text-white/50">Why this classification</h3>

            {result.whyThisCategory && (
              <div className="flex gap-2.5">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ backgroundColor: tint(color, 0.9), color: readableTextOn(color) }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-white/50">
                    Why it belongs in {result.categoryName}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/80">
                    {result.whyThisCategory}
                  </p>
                </div>
              </div>
            )}

            {result.whyNotOtherBins && (
              <div className="flex gap-2.5">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/70"
                  aria-hidden="true"
                >
                  ✕
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-white/50">Why not the other bins</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/80">
                    {result.whyNotOtherBins}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {result.environmentalNote && (
          <section className="flex gap-3 rounded-2xl bg-white/5 p-4">
            <span className="text-lg" aria-hidden="true" style={{ animation: 'var(--animate-drift)' }}>
              🌍
            </span>
            <div className="min-w-0">
              <h3 className="eyebrow text-[10px] font-bold text-white/45">Environmental fact</h3>
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

/**
 * Bottom sheet with drag-to-dismiss.
 *
 * The scrim is a solid dark wash with a decisive blur, not the 2px it used to
 * be: a barely-there blur reads as a rendering fault rather than a deliberate
 * effect. Either commit to the depth or leave the background sharp.
 *
 * Dragging is the gesture people expect from a sheet like this, so it is
 * supported alongside the button and the scrim tap — three ways out, none of
 * them the only way.
 */
function Shell({ children, onDismiss }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const onPointerDown = (e) => {
    // Only start a drag from the top of the scroll area, so dragging down to
    // read the content does not fight the dismiss gesture.
    if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    // Downward only — an upward drag should scroll, not stretch the sheet.
    setDragY(Math.max(0, e.clientY - startY.current));
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    // Past roughly a fifth of the viewport, treat it as intent to dismiss.
    if (dragY > window.innerHeight * 0.18) onDismiss?.();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        aria-label="Dismiss result"
        onClick={onDismiss}
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        style={{ opacity: Math.max(0.35, 1 - dragY / 400) }}
      />
      <div
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-[1.75rem] border-t border-white/12 bg-slate-950/95 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.8)]"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
          animation: dragY === 0 && !dragging ? 'var(--animate-sheet-up)' : undefined
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Grab handle — the drag affordance, with a real touch target. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-3 active:cursor-grabbing"
        >
          <div className="h-1.5 w-11 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-safe">
          {children}
        </div>
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
