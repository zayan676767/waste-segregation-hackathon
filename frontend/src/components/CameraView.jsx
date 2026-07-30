import Notice from './Notice.jsx';

/**
 * The camera stage: live preview, the frozen snapshot canvas, and the controls.
 *
 * The video element always stays mounted — remounting it mid-session is what
 * causes black previews on mobile Safari. When a frame is snapped the canvas is
 * layered on top instead of swapping the video out.
 */
export default function CameraView({
  cam,
  mode,
  frozen,
  canvasRef,
  onSnap,
  onResume,
  onRetry,
  busy,
  liveActive,
  overlay
}) {
  const mirrored = cam.facingMode === 'user';

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-white/10 bg-black sm:aspect-video">
        <video
          ref={cam.videoRef}
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            cam.isReady && !frozen ? 'opacity-100' : 'opacity-0'
          } ${mirrored ? '-scale-x-100' : ''}`}
        />

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            frozen ? 'opacity-100' : 'pointer-events-none opacity-0'
          } ${mirrored ? '-scale-x-100' : ''}`}
        />

        {/* Starting / idle placeholder */}
        {!cam.isReady && !cam.error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
            <p className="text-sm text-white/55">
              {cam.status === 'starting' ? 'Starting camera…' : 'Camera off'}
            </p>
          </div>
        )}

        {/* Framing guide keeps the item roughly centred, which noticeably
            improves accuracy on a 224x224 model. */}
        {cam.isReady && !frozen && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-3/5 w-3/5 rounded-2xl border-2 border-white/25 shadow-[0_0_0_100vmax_rgba(0,0,0,0.18)]" />
          </div>
        )}

        {/* Live badge */}
        {cam.isReady && !frozen && mode === 'live' && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 backdrop-blur-sm">
            <span
              className={`h-1.5 w-1.5 rounded-full bg-red-500 ${liveActive ? 'animate-breathe' : ''}`}
            />
            <span className="text-[10px] font-semibold eyebrow text-white/90">
              Live
            </span>
          </div>
        )}

        {frozen && (
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold eyebrow text-slate-900">
            Frozen frame
          </div>
        )}

        {cam.isReady && (
          <button
            onClick={cam.flip}
            /* min 44px so it is comfortably tappable on a phone. */
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white/90 backdrop-blur-sm transition active:scale-95"
            aria-label="Switch camera"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 12a10 10 0 0 1 10-10 10 10 0 0 1 8 4" />
              <path d="M20 2v4h-4" />
              <path d="M22 12a10 10 0 0 1-10 10A10 10 0 0 1 4 18" />
              <path d="M4 22v-4h4" />
            </svg>
          </button>
        )}

        {overlay}
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
                onClick={onRetry}
                className="inline-flex min-h-11 items-center rounded-lg bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Retry camera
              </button>
            )
          }
        />
      )}

      {/* Pause & Snap is the primary action in snap mode: full width, high
          contrast, impossible to miss under stage lighting. */}
      {mode === 'snap' && cam.isReady && (
        <div className="grid gap-2">
          {!frozen ? (
            <button
              onClick={onSnap}
              disabled={busy}
              className="w-full rounded-2xl bg-white py-4 text-base font-bold text-slate-900 shadow-xl shadow-black/25 transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? 'Classifying…' : 'Pause & Snap'}
            </button>
          ) : (
            <button
              onClick={onResume}
              className="w-full rounded-2xl border border-white/20 bg-white/5 py-4 text-base font-bold text-white transition hover:bg-white/10 active:scale-[0.98]"
            >
              Resume Live
            </button>
          )}
        </div>
      )}
    </div>
  );
}
