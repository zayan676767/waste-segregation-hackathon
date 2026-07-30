import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { prettyLabel } from '../../lib/classifier.js';
import { getSocket } from '../../lib/socket.js';
import { readableTextOn } from '../../lib/color.js';
import { Button, ConfirmButton, SectionCard } from './ui.jsx';

const PAGE_SIZE = 50;

export default function ScanLog({ onFlash }) {
  const [state, setState] = useState({ scans: [], total: 0, status: 'loading', error: null });

  const load = useCallback(async () => {
    try {
      const data = await api.getScans(`?limit=${PAGE_SIZE}`);
      setState({ scans: data.scans, total: data.total, status: 'ready', error: null });
    } catch (err) {
      setState((s) => ({ ...s, status: 'error', error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();

    // Keep the log live so it matches the dashboard while scanning.
    const socket = getSocket();
    socket.on('scan', load);
    socket.on('scans:cleared', load);
    return () => {
      socket.off('scan', load);
      socket.off('scans:cleared', load);
    };
  }, [load]);

  const clearAll = async () => {
    try {
      const result = await api.clearScans();
      onFlash({ message: `Cleared ${result.deleted} scan(s)` });
      load();
    } catch (err) {
      onFlash({ tone: 'error', message: err.message });
    }
  };

  return (
    <SectionCard
      title="Scan log"
      description={
        state.status === 'ready'
          ? `${state.total} scan${state.total === 1 ? '' : 's'} recorded${
              state.total > PAGE_SIZE ? ` — showing the latest ${PAGE_SIZE}` : ''
            }`
          : 'Loading…'
      }
      action={
        <Button onClick={load} disabled={state.status === 'loading'}>
          Refresh
        </Button>
      }
    >
      {state.status === 'error' && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {state.error}
        </p>
      )}

      {state.status === 'loading' && (
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-11 rounded-xl" />
          ))}
        </div>
      )}

      {state.status === 'ready' && state.scans.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/4 p-4 text-center text-sm text-white/45">
          No scans yet. Classify something on the Scan page and it will appear here.
        </p>
      )}

      {state.scans.length > 0 && (
        <>
          <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur">
                <tr className="text-[10px] eyebrow text-white/40">
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 text-right font-semibold">Conf.</th>
                  <th className="hidden px-3 py-2 font-semibold sm:table-cell">Source</th>
                  <th className="hidden px-3 py-2 font-semibold sm:table-cell">When (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {state.scans.map((scan) => {
                  const color = scan.categoryColor ?? '#94a3b8';
                  return (
                    <tr key={scan.id} className="border-t border-white/6">
                      <td className="max-w-[10rem] truncate px-3 py-2 text-white/85">
                        {prettyLabel(scan.label) || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: color, color: readableTextOn(color) }}
                        >
                          {scan.categoryName ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-white/85">
                        {Math.round((scan.confidence ?? 0) * 100)}%
                      </td>
                      <td className="hidden px-3 py-2 text-xs eyebrow text-white/40 sm:table-cell">
                        {scan.source}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-white/40 sm:table-cell">
                        {scan.createdAt}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/10 pt-3">
            <ConfirmButton
              label="Clear scan log"
              confirmLabel="Yes, clear everything"
              warning={`This permanently deletes all ${state.total} scan(s) and resets the dashboard totals to zero. This cannot be undone.`}
              onConfirm={clearAll}
            />
          </div>
        </>
      )}
    </SectionCard>
  );
}
