import { useEffect, useState } from 'react';
import Notice from './Notice.jsx';

// Probed rather than hardcoded as a fixed list: whichever of these exist in
// /public/samples get shown, so dropping the photos in needs no code change.
const CANDIDATES = [];
for (const n of [1, 2, 3, 4, 5, 6]) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    CANDIDATES.push(`/samples/sample-${n}.${ext}`);
  }
}

function probe(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? src : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Camera-free input path. This is the demo's hard fallback: it works with
 * permission denied, no camera at all, or a page served over plain http.
 */
export default function SampleGrid({ onPick, busy, activeSrc }) {
  const [available, setAvailable] = useState(null); // null = still probing

  useEffect(() => {
    let cancelled = false;
    Promise.all(CANDIDATES.map(probe)).then((results) => {
      if (cancelled) return;
      // Keep only the first hit per slot number, so sample-1.jpg and
      // sample-1.png do not both appear.
      const seen = new Set();
      const found = [];
      for (const src of results.filter(Boolean)) {
        const slot = src.match(/sample-(\d+)\./)?.[1];
        if (slot && !seen.has(slot)) {
          seen.add(slot);
          found.push(src);
        }
      }
      setAvailable(found.slice(0, 6));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (available === null) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton aspect-square rounded-2xl" />
        ))}
      </div>
    );
  }

  if (available.length === 0) {
    return (
      <Notice
        tone="warn"
        title="No sample photos yet"
        message="This mode needs a few real photographs to classify."
        hint="Save 4 photos as sample-1.jpg … sample-4.jpg into frontend/public/samples/ — a plastic bottle, a banana, a battery or old phone, and a cardboard box work well. They must be real photos, not drawings."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {available.map((src, i) => {
          const active = activeSrc === src;
          return (
            <button
              key={src}
              /* Only the path is handed over — the page loads the photo at full
                 resolution rather than classifying this scaled-down thumbnail. */
              onClick={() => onPick(src)}
              disabled={busy}
              className={`group relative aspect-square overflow-hidden rounded-2xl border-2 transition-all duration-200 disabled:opacity-60 ${
                active
                  ? 'border-white shadow-lg shadow-black/30'
                  : 'border-white/10 hover:border-white/35'
              }`}
              style={{ animation: `var(--animate-fade-up)`, animationDelay: `${i * 60}ms` }}
            >
              <img
                src={src}
                alt={`Sample waste item ${i + 1}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {active && (
                <span className="absolute inset-x-0 bottom-0 bg-black/65 py-1 text-center text-[10px] font-semibold eyebrow text-white">
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-white/40">
        Tap a photo to classify it — no camera required.
      </p>
    </div>
  );
}
