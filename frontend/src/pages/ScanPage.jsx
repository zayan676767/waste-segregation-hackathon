import { useCallback, useEffect, useRef, useState } from 'react';
import { getCameraAvailability, useCamera } from '../lib/useCamera.js';
import { classifyFrame, frameToBase64, getVisionStatus, loadImage } from '../lib/vision.js';
import { useAppData } from '../lib/useAppData.js';
import Notice from '../components/Notice.jsx';
import ScanningOverlay from '../components/ScanningOverlay.jsx';
import ResultSheet from '../components/ResultSheet.jsx';
import SampleGrid from '../components/SampleGrid.jsx';

const RECENT_LIMIT = 8;

/**
 * v2 scan screen.
 *
 * Continuous live inference is gone by design: every scan is now one deliberate
 * Gemini request. That removes the rate-limit problem entirely (15 req/min per
 * key) and makes each result worth reading, since the model gets a considered
 * still rather than a motion-blurred video frame.
 */
export default function ScanPage() {
  const { categories, status: dataStatus } = useAppData();
  const cam = useCamera();

  const [mode, setMode] = useState('camera');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);
  const [vision, setVision] = useState(null);
  const [activeSample, setActiveSample] = useState(null);

  const busyRef = useRef(false);

  useEffect(() => {
    getVisionStatus().then(setVision);
  }, []);

  // A camera is impossible on plain http and in browsers without getUserMedia —
  // drop straight to the sample path rather than showing an unfixable error.
  useEffect(() => {
    if (getCameraAvailability() !== 'available') setMode('samples');
  }, []);

  useEffect(() => {
    if (mode === 'samples') {
      cam.stop();
    } else {
      cam.start();
      cam.videoRef.current?.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const runClassification = useCallback(async ({ base64, dataUrl, source }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setPhoto(dataUrl);
    setResult(null);

    try {
      const outcome = await classifyFrame({ base64, source });
      setResult(outcome);

      if (outcome.status === 'ok') {
        setRecent((prev) =>
          [{ id: Date.now(), photo: dataUrl, ...outcome }, ...prev].slice(0, RECENT_LIMIT)
        );
      }
    } catch (err) {
      setError(err.message || 'Classification failed');
      setPhoto(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const handleShutter = () => {
    const video = cam.videoRef.current;
    if (!video || busy) return;
    try {
      const frame = frameToBase64(video);
      video.pause();
      runClassification({ base64: frame.base64, dataUrl: frame.dataUrl, source: 'snap' });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSample = async (src) => {
    if (busy) return;
    setActiveSample(src);
    try {
      const img = await loadImage(src);
      const frame = frameToBase64(img);
      runClassification({ base64: frame.base64, dataUrl: frame.dataUrl, source: 'sample' });
    } catch (err) {
      setError(err.message);
    }
  };

  const dismiss = () => {
    setResult(null);
    setPhoto(null);
    setActiveSample(null);
    if (mode === 'camera') cam.videoRef.current?.play().catch(() => {});
  };

  const accentColors = categories.map((c) => c.color).slice(0, 4);
  const frozen = Boolean(photo) && (busy || Boolean(result));

  return (
    <div className="flex flex-col gap-4">
      {vision && !vision.configured && (
        <Notice
          tone="warn"
          title="No Gemini key configured"
          message="Scans will fall back to the limited on-device model."
          hint="Add GEMINI_API_KEY to backend/.env and restart the backend."
        />
      )}

      {vision?.configured && vision.keys?.some((k) => !k.looksLikeAiStudioKey) && (
        <Notice
          tone="warn"
          title="API key may be the wrong type"
          message="A key that does not start with AIza is a Google Cloud key, which the Gemini API rejects."
          hint="Create one at aistudio.google.com/apikey instead."
        />
      )}

      {error && (
        <Notice
          tone="error"
          title="Could not identify that"
          message={error}
          hint="Check the connection and try again — sample photos work offline."
        />
      )}

      <ModeToggle mode={mode} onChange={setMode} disabled={busy} />

      {mode === 'camera' ? (
        <div className="space-y-4">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-black sm:aspect-[4/3]">
            <video
              ref={cam.videoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover transition-opacity duration-300 ${
                cam.isReady && !frozen ? 'opacity-100' : 'opacity-0'
              } ${cam.facingMode === 'user' ? '-scale-x-100' : ''}`}
            />

            {frozen && photo && !busy && (
              <img
                src={photo}
                alt="Captured item"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {!cam.isReady && !cam.error && !frozen && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
                <p className="text-sm text-white/55">Starting camera…</p>
              </div>
            )}

            {/* Framing guide, only while composing */}
            {cam.isReady && !frozen && (
              <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/20" />
            )}

            {cam.isReady && !frozen && (
              <button
                onClick={cam.flip}
                aria-label="Switch camera"
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition active:scale-95"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M2 12a10 10 0 0 1 10-10 10 10 0 0 1 8 4" />
                  <path d="M20 2v4h-4" />
                  <path d="M22 12a10 10 0 0 1-10 10A10 10 0 0 1 4 18" />
                  <path d="M4 22v-4h4" />
                </svg>
              </button>
            )}

            {busy && <ScanningOverlay photo={photo} accentColors={accentColors} />}
          </div>

          {cam.error && (
            <Notice
              tone={cam.error.code === 'denied' || cam.error.code === 'insecure' ? 'warn' : 'error'}
              title={cam.error.title}
              message={cam.error.message}
              hint={cam.error.hint}
              action={
                cam.error.code === 'insecure' || cam.error.code === 'unsupported' ? null : (
                  <button
                    onClick={() => cam.start()}
                    className="inline-flex min-h-11 items-center rounded-lg bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/20"
                  >
                    Retry camera
                  </button>
                )
              }
            />
          )}

          {cam.isReady && <Shutter onClick={handleShutter} busy={busy} />}
        </div>
      ) : (
        <SampleGrid onPick={handleSample} busy={busy} activeSrc={activeSample} />
      )}

      <RecentStrip items={recent} />

      <ResultSheet result={result} photo={photo} onDismiss={dismiss} onScanAgain={dismiss} />

      {dataStatus === 'error' && (
        <Notice
          tone="error"
          title="Cannot reach the backend"
          message="Start it with npm run dev from the project root."
        />
      )}
    </div>
  );
}

function ModeToggle({ mode, onChange, disabled }) {
  const options = [
    { id: 'camera', label: 'Camera' },
    { id: 'samples', label: 'Samples' }
  ];
  return (
    <div
      role="tablist"
      aria-label="Input mode"
      className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1"
    >
      {options.map((o) => {
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            disabled={disabled && !active}
            onClick={() => onChange(o.id)}
            className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition-all duration-200 disabled:opacity-40 ${
              active
                ? 'bg-white text-slate-900 shadow-lg shadow-black/25'
                : 'text-white/55 hover:text-white/85'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Camera-app shutter: large, centred, unmissable under stage lighting. */
function Shutter({ onClick, busy }) {
  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <button
        onClick={onClick}
        disabled={busy}
        aria-label="Capture and identify"
        className="group relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full transition active:scale-95 disabled:opacity-50"
      >
        <span className="absolute inset-0 rounded-full border-[3px] border-white/85" />
        <span className="h-[3.4rem] w-[3.4rem] rounded-full bg-white transition group-active:scale-90" />
      </button>
      <p className="text-xs font-medium text-white/40">{busy ? 'Identifying…' : 'Tap to identify'}</p>
    </div>
  );
}

/** This session's scans — makes the app feel alive during a demo run. */
function RecentStrip({ items }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="eyebrow px-1 text-[10px] font-semibold text-white/35">This session</h2>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="animate-fade-up flex w-32 shrink-0 flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-2"
          >
            <img src={item.photo} alt="" className="h-16 w-full rounded-xl object-cover" />
            <p className="truncate text-[11px] font-semibold text-white/85">{item.itemName}</p>
            <span
              className="truncate rounded-md px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                backgroundColor: `${item.categoryColor}22`,
                color: item.categoryColor ?? '#94a3b8'
              }}
            >
              {item.categoryName}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
