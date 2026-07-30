import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';
import { setting, useAppData } from '../lib/useAppData.js';
import { tint } from '../lib/color.js';
import CategoryBarChart from '../components/dashboard/CategoryBarChart.jsx';
import ScanFeed from '../components/dashboard/ScanFeed.jsx';

// Enough history to look busy on screen without growing unbounded over a long
// judging session.
const FEED_LIMIT = 40;

export default function DashboardPage() {
  const { settings } = useAppData();
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const seenIds = useRef(new Set());

  const title = setting(settings, 'app_title', 'Smart Waste Segregation Assistant');

  useEffect(() => {
    let cancelled = false;

    // Seed from REST so the screen is populated even before the socket settles.
    api
      .getStats()
      .then((initial) => {
        if (cancelled) return;
        setStats(initial);
        setFeed(initial.recentScans.slice(0, FEED_LIMIT));
        for (const s of initial.recentScans) seenIds.current.add(s.id);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message));

    const socket = getSocket();
    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    // Totals and the chart come from the stats snapshot the server sends after
    // every scan, so they can never drift out of sync with the database.
    const onStats = (next) => {
      setStats(next);
      setError(null);
    };
    // The feed is driven by individual scan events so only the new row animates.
    const onScan = (scan) => {
      if (seenIds.current.has(scan.id)) return;
      seenIds.current.add(scan.id);
      setFeed((prev) => [scan, ...prev].slice(0, FEED_LIMIT));
    };
    const onCleared = () => {
      seenIds.current.clear();
      setFeed([]);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('stats', onStats);
    socket.on('scan', onScan);
    socket.on('scans:cleared', onCleared);

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('stats', onStats);
      socket.off('scan', onScan);
      socket.off('scans:cleared', onCleared);
    };
  }, []);

  // No snapshot yet and nothing has failed — show skeletons instead of zeroes.
  const loading = stats === null && !error;
  const total = stats?.totalScans ?? 0;
  const categories = stats?.byCategory ?? [];
  const leader = categories.reduce(
    (best, c) => (c.count > (best?.count ?? -1) ? c : best),
    null
  );

  return (
    <div className="flex min-h-screen flex-col gap-5 p-5 lg:h-screen lg:gap-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl lg:text-4xl" aria-hidden="true">
            ♻️
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-white lg:text-3xl">
              {title}
            </h1>
            <p className="text-xs eyebrow text-white/35 lg:text-sm">
              Live segregation dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionBadge connected={connected} />
          <Link
            to="/"
            className="flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Scan
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/8 p-4 text-sm text-white/80">
          Cannot reach the backend ({error}). The dashboard will recover on its own once
          it is running again.
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        {/* ---- left: headline numbers + breakdown ---- */}
        <div className="flex min-h-0 flex-col gap-5">
          <section className="panel p-5 lg:p-7">
            <p className="text-xs font-semibold eyebrow text-white/40 lg:text-sm">
              Total items scanned
            </p>
            {/* A skeleton rather than a placeholder zero: on a projected screen a
                real-looking 0 that jumps to the true total reads as a glitch. */}
            {loading ? (
              <div className="skeleton mt-2 h-14 w-40 lg:h-24 lg:w-56" />
            ) : (
              <p className="mt-1 text-6xl font-black leading-none tabular-nums text-white lg:text-8xl">
                {total.toLocaleString()}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/45 lg:text-sm">
              <span>
                Avg confidence{' '}
                <strong className="font-bold text-white/80 tabular-nums">
                  {Math.round((stats?.averageConfidence ?? 0) * 100)}%
                </strong>
              </span>
              {leader && leader.count > 0 && (
                <span>
                  Most common{' '}
                  <strong className="font-bold text-white/80">{leader.name}</strong>
                </span>
              )}
            </div>
          </section>

          <section className="panel flex min-h-0 flex-1 flex-col p-5 lg:p-6">
            <h2 className="text-xs font-semibold eyebrow text-white/40 lg:text-sm">
              Category breakdown
            </h2>
            <div className="mt-4 min-h-[190px] flex-1">
              {loading ? (
                <div className="flex h-full flex-col justify-center gap-4">
                  {[0.9, 0.65, 0.4].map((w, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="skeleton h-4 w-28 shrink-0" />
                      <div className="skeleton h-7 rounded-md" style={{ width: `${w * 60}%` }} />
                    </div>
                  ))}
                </div>
              ) : (
                <CategoryBarChart data={categories} total={total} />
              )}
            </div>
            <SourceSplit bySource={stats?.bySource} />
          </section>
        </div>

        {/* ---- right: live feed ---- */}
        <section className="panel flex min-h-0 flex-col p-5 lg:p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold eyebrow text-white/40 lg:text-sm">
              Live activity
            </h2>
            {feed.length > 0 && (
              <span className="text-xs text-white/30">last {feed.length}</span>
            )}
          </div>
          {/* The list scrolls inside this panel so the page itself never does. */}
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-14 rounded-xl" />
                ))}
              </div>
            ) : (
              <ScanFeed scans={feed} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ConnectionBadge({ connected }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2"
      style={{
        borderColor: connected ? tint('#22c55e', 0.3) : tint('#f59e0b', 0.3),
        backgroundColor: connected ? tint('#22c55e', 0.1) : tint('#f59e0b', 0.1)
      }}
      role="status"
      aria-live="polite"
    >
      <span
        className={`h-2 w-2 rounded-full ${connected ? 'animate-breathe' : ''}`}
        style={{ backgroundColor: connected ? '#22c55e' : '#f59e0b' }}
        aria-hidden="true"
      />
      <span className="text-xs font-bold eyebrow text-white/80">
        {connected ? 'Live' : 'Reconnecting'}
      </span>
    </div>
  );
}

function SourceSplit({ bySource }) {
  if (!bySource) return null;
  const entries = [
    ['Live', bySource.live ?? 0],
    ['Snap', bySource.snap ?? 0],
    ['Sample', bySource.sample ?? 0]
  ];
  const total = entries.reduce((a, [, n]) => a + n, 0);
  if (total === 0) return null;

  return (
    <div className="mt-4 flex gap-2 border-t border-white/8 pt-4">
      {entries.map(([label, count]) => (
        <div key={label} className="flex-1 rounded-xl bg-white/4 px-3 py-2 text-center">
          <p className="text-lg font-bold tabular-nums text-white/90">{count}</p>
          <p className="text-[10px] eyebrow text-white/35">{label}</p>
        </div>
      ))}
    </div>
  );
}
