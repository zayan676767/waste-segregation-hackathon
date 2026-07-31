import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../lib/api.js';

/**
 * A "scan to join" QR code for the projected dashboard.
 *
 * The point: a judge walking up to the booth can point their own phone at the
 * screen and land straight on the scanner — no typing a fiddly self-signed
 * https LAN address by hand.
 *
 * The host comes from the backend (its own LAN IPv4, the address a phone must
 * actually reach), while the scheme and port come from THIS page's own
 * window.location. That combination is what makes the link correct in every
 * mode: https on `npm run dev:https`, http otherwise, and always the port the
 * frontend is really being served on.
 *
 * Renders nothing at all when there is no reachable LAN address (e.g. the
 * laptop is on no network) rather than showing a QR that cannot resolve.
 */
export default function QrJoinPanel() {
  const [url, setUrl] = useState(null);
  const [svg, setSvg] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api
      .getNetwork()
      .then((net) => {
        if (cancelled || !net?.primary) return;
        const port = window.location.port ? `:${window.location.port}` : '';
        const target = `${window.location.protocol}//${net.primary}${port}/`;
        setUrl(target);
      })
      .catch(() => {
        /* No network info — the panel simply stays hidden. */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    })
      .then((out) => !cancelled && setSvg(out))
      .catch(() => !cancelled && setSvg(null));

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url || !svg) return null;

  return (
    <section className="panel flex items-center gap-4 p-4 lg:p-5">
      {/* White quiet-zone card so the code stays high-contrast on the dark
          dashboard and scans reliably from across the booth. */}
      <div
        className="h-20 w-20 shrink-0 rounded-xl bg-white p-1.5 lg:h-24 lg:w-24 [&_svg]:h-full [&_svg]:w-full"
        // The SVG comes from the qrcode library, not user input, so injecting
        // it as markup is safe and keeps the code crisp at any projected size.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold eyebrow text-white/40 lg:text-sm">Scan to join</p>
        <p className="mt-1 text-sm font-bold leading-snug text-white lg:text-base">
          Point your phone camera at this code to start sorting.
        </p>
        <p className="mt-1 truncate font-mono text-[11px] text-white/35" title={url}>
          {url}
        </p>
      </div>
    </section>
  );
}
