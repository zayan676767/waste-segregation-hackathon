/**
 * The app's logo lockup.
 *
 * A drawn glyph rather than the ♻️ emoji it replaced: an emoji renders as a
 * different picture on every OS, sits on a coloured background it does not
 * control, and cannot be tinted to match the app. This is one SVG that looks
 * identical on the phone, the laptop and the projector.
 *
 * The loop is one arc-plus-arrowhead drawn three times at 120° apart rather
 * than three hand-placed paths, so the symmetry is exact by construction
 * instead of by eye.
 */

const CENTER = 12;
// Each arm spans 80° of the circle, leaving 40° gaps between them.
const ARM_ARC = 'M10.78 5.11 A7 7 0 0 1 18.58 9.61';
const ARM_HEAD = 'M19.15 6.21 L18.58 9.61 L15.96 7.37';

export default function BrandMark({ size = 'sm' }) {
  const box = size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-9 w-9 rounded-xl';
  const glyph = size === 'lg' ? 28 : 21;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center ${box} bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/25 ring-1 ring-white/25`}
      aria-hidden="true"
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#052e22"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animation: 'brand-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) both' }}
      >
        {[0, 120, 240].map((deg) => (
          <g key={deg} transform={`rotate(${deg} ${CENTER} ${CENTER})`}>
            <path d={ARM_ARC} />
            <path d={ARM_HEAD} />
          </g>
        ))}
      </svg>
    </span>
  );
}
