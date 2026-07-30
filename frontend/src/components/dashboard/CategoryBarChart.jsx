import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

/**
 * Category breakdown, built for a projector at the back of a room.
 *
 * Horizontal bars because the categories are words — read left to right at any
 * distance — and because magnitude comparison is the job here.
 *
 * Identity never depends on colour. Category colours are database values the
 * user can change to anything in admin, so a validated palette cannot be
 * guaranteed at runtime; every bar therefore carries its name on the axis and
 * its count as a direct label. Colour is reinforcement, not the encoding.
 *
 * One series, so no legend box — the axis labels name each bar.
 */
export default function CategoryBarChart({ data, total }) {
  if (!data?.length) return null;

  // A tiny floor so a zero-count category still shows a sliver of its colour
  // rather than vanishing from the chart entirely.
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 64, bottom: 4, left: 4 }}
          barCategoryGap="28%"
        >
          {/* Axes stay recessive: no grid, no axis lines, no tick marks. */}
          <XAxis type="number" domain={[0, max]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.78)', fontSize: 17, fontWeight: 600 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            content={<ChartTooltip total={total} />}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.categoryId} fill={d.color} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              offset={12}
              /* Text wears a text token, not the series colour. */
              fill="rgba(255,255,255,0.95)"
              fontSize={22}
              fontWeight={800}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: row.color }}
          aria-hidden="true"
        />
        <span className="text-sm font-semibold text-white">{row.name}</span>
      </div>
      <p className="mt-0.5 text-xs text-white/60">
        {row.count} {row.count === 1 ? 'item' : 'items'} · {pct}% of all scans
      </p>
    </div>
  );
}
