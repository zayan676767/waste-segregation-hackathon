import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Every way the camera can fail, translated into something a human can act on.
 * Nothing here ends up as a silent console error — each case has an on-screen
 * message and a concrete next step.
 */
export const CAMERA_ERRORS = {
  insecure: {
    title: 'Camera needs a secure connection',
    message:
      'Browsers only allow camera access over https (or on localhost). This page was opened over plain http.',
    hint: 'Open the https tunnel URL on this device, or use Sample Images below — they work without a camera.'
  },
  unsupported: {
    title: 'This browser cannot open a camera',
    message: 'The getUserMedia API is unavailable, so no live preview is possible here.',
    hint: 'Try Chrome or Safari, or use Sample Images below.'
  },
  denied: {
    title: 'Camera permission was blocked',
    message: 'The browser is refusing camera access for this page.',
    hint: 'Tap the padlock or camera icon in the address bar, allow the camera, then press Retry.'
  },
  notfound: {
    title: 'No camera found',
    message: 'This device does not report any usable camera.',
    hint: 'Plug in a webcam, or use Sample Images below — they need no camera at all.'
  },
  inuse: {
    title: 'Camera is busy',
    message: 'Another app or browser tab is already using the camera.',
    hint: 'Close other apps or tabs using the camera (video calls, other browser windows), then press Retry.'
  },
  unknown: {
    title: 'Could not start the camera',
    message: 'The camera failed to start for an unexpected reason.',
    hint: 'Press Retry, or use Sample Images below.'
  }
};

/** Maps a getUserMedia rejection to one of the error codes above. */
function classifyError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'notfound';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'inuse';
  if (name === 'SecurityError') return 'insecure';
  return 'unknown';
}

/**
 * Checked before touching getUserMedia so the insecure-http case shows a clear
 * explanation instead of a confusing "undefined is not a function".
 * localhost is exempt from the https requirement, which is why testing on the
 * dev machine works but opening the LAN IP on a phone does not.
 */
export function getCameraAvailability() {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  return 'available';
}

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Guards against React StrictMode's double-mount and rapid mode switching:
  // a start that finishes after a newer one began is discarded.
  const tokenRef = useRef(0);

  const [status, setStatus] = useState('idle'); // idle | starting | ready | error
  const [errorCode, setErrorCode] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');

  const stop = useCallback(() => {
    tokenRef.current += 1;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  const start = useCallback(async (requestedFacing) => {
    const availability = getCameraAvailability();
    if (availability !== 'available') {
      setErrorCode(availability);
      setStatus('error');
      return;
    }

    const facing = requestedFacing || facingMode;
    const existing = streamRef.current;

    // Already streaming on the requested camera — reuse it. Switching between
    // Live and Pause & Snap must not tear the stream down and ask the device
    // again, which causes a visible flicker and a needless permission round.
    if (existing?.getVideoTracks().some((t) => t.readyState === 'live') && facing === facingMode) {
      setStatus('ready');
      return;
    }

    // Release any previous stream BEFORE requesting a new one. Overwriting
    // streamRef without stopping the old tracks leaves the camera open: the
    // indicator light stays on, battery drains, and a repeat getUserMedia on a
    // device that is still busy fails with NotReadableError after a few mode
    // switches — which surfaced as a bogus "camera is busy" error mid-demo.
    if (existing) {
      for (const track of existing.getTracks()) track.stop();
      streamRef.current = null;
    }

    const token = ++tokenRef.current;
    setStatus('starting');
    setErrorCode(null);

    // `ideal` rather than `exact` so a laptop with only a front camera still
    // works instead of throwing OverconstrainedError.
    const constraints = {
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError') {
        // Retry with no constraints at all before reporting failure.
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (retryErr) {
          if (token !== tokenRef.current) return;
          setErrorCode(classifyError(retryErr));
          setStatus('error');
          return;
        }
      } else {
        if (token !== tokenRef.current) return;
        setErrorCode(classifyError(err));
        setStatus('error');
        return;
      }
    }

    // A newer start (or a stop) happened while we were waiting for permission.
    if (token !== tokenRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Some browsers reject play() until a user gesture; the stream is still
      // attached and the poster frame shows, so this is not fatal.
    }

    if (token !== tokenRef.current) return;
    setFacingMode(facing);
    setStatus('ready');
  }, [facingMode]);

  const flip = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    stop();
    start(next);
  }, [facingMode, start, stop]);

  // Release the camera when the component using it goes away, so the device's
  // camera indicator light actually turns off.
  useEffect(() => stop, [stop]);

  return {
    videoRef,
    status,
    error: errorCode ? { code: errorCode, ...CAMERA_ERRORS[errorCode] } : null,
    facingMode,
    start,
    stop,
    flip,
    isReady: status === 'ready'
  };
}
