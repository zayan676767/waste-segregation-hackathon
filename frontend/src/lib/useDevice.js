import { useEffect, useState } from 'react';

/**
 * Which screens this device is allowed to show.
 *
 *   phone   -> Scan + Dashboard   (the thing you point at rubbish)
 *   desktop -> Dashboard + Admin  (the projected screen and the operator console)
 *
 * A laptop has no business running the camera screen during the demo, and a
 * phone has no business exposing the admin panel to whoever is holding it.
 *
 * Detection uses `pointer: coarse` — a real capability query for "the primary
 * input is a finger" — rather than sniffing the user-agent string, which lies
 * routinely and needs updating forever. It is paired with a width check so a
 * large touchscreen laptop is still treated as a desktop.
 *
 * `?device=phone` / `?device=desktop` overrides it. Detection is a heuristic,
 * and on borrowed hardware at a venue there is no time to debug a wrong guess
 * — the escape hatch matters more than the cleverness.
 */
const OVERRIDE_KEY = 'wsa:device-override';

function detect() {
  if (typeof window === 'undefined') return 'desktop';

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('device');
  if (fromUrl === 'phone' || fromUrl === 'desktop') {
    // Persist so the choice survives navigation between screens.
    try {
      window.localStorage.setItem(OVERRIDE_KEY, fromUrl);
    } catch {
      /* private mode — the URL param still applies for this page */
    }
    return fromUrl;
  }

  try {
    const stored = window.localStorage.getItem(OVERRIDE_KEY);
    if (stored === 'phone' || stored === 'desktop') return stored;
  } catch {
    /* ignore */
  }

  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrow = window.matchMedia?.('(max-width: 1024px)').matches ?? false;
  return coarse && narrow ? 'phone' : 'desktop';
}

export function useDevice() {
  const [device, setDevice] = useState(detect);

  useEffect(() => {
    // Re-evaluate on rotate/resize so a tablet flipping orientation, or a
    // desktop window being narrowed, lands on the right layout.
    const onChange = () => setDevice(detect());
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
    };
  }, []);

  const isPhone = device === 'phone';

  return {
    device,
    isPhone,
    isDesktop: !isPhone,
    /** Screens this device may open, in nav order. */
    allowedRoutes: isPhone ? ['/', '/dashboard'] : ['/dashboard', '/admin'],
    /** Where this device should land by default. */
    homeRoute: isPhone ? '/' : '/dashboard',
    setDevice: (next) => {
      try {
        window.localStorage.setItem(OVERRIDE_KEY, next);
      } catch {
        /* ignore */
      }
      setDevice(next);
    }
  };
}
