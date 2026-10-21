import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber } from '../../lib/format';

// Horizontal bar chart: one indigo series, value labels, hover tooltip, plus a table view.
export default function RegistrationsChart({ data }) {
  const [asTable, setAsTable] = useState(false);
  const rows = data.map((d) => ({ ...d, label: d.title.length > 28 ? `${d.title.slice(0, 27)}…` : d.title }));
  const height = Math.max(160, rows.length * 44 + 20);

  return (
    <section aria-labelledby="chart-title" className="flex min-w-0 flex-[2_1_520px] flex-col gap-5 rounded-card border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="chart-title" className="text-lg font-bold">
            Registrations per event
          </h2>
          <p className="text-sm text-muted">Seats taken so far, top {rows.length} events</p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => setAsTable((t) => !t)}
            className="min-h-10 rounded-[10px] border border-line px-3.5 text-sm font-semibold text-ink-2 hover:border-brand-300"
          >
            {asTable ? 'View as chart' : 'View as table'}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-muted">No events yet — create one to see registrations here.</p>
      ) : asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="text-left text-xs tracking-wider text-muted uppercase">
                <th className="py-2 font-semibold">Event</th>
                <th className="py-2 text-right font-semibold">Registrations</th>
                <th className="py-2 text-right font-semibold">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2.5 pr-3">{r.title}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{formatNumber(r.registrations)}</td>
                  <td className="py-2.5 text-right text-muted tabular-nums">{formatNumber(r.capacity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label="Bar chart of registrations per event">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke="#EEF0F5" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: '#5B6475', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={190}
                tick={{ fill: '#3B4252', fontSize: 13 }}
                axisLine={{ stroke: '#D9DCE6' }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: '#EEF0FF' }}
                contentStyle={{ borderRadius: 12, border: '1px solid #E6E8F0', boxShadow: '0 12px 24px -12px rgb(15 23 42 / .25)' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.title}
                formatter={(value, _name, item) => [`${formatNumber(value)} of ${formatNumber(item.payload.capacity)} seats`, 'Registrations']}
              />
              <Bar dataKey="registrations" fill="#4F46E5" radius={[0, 4, 4, 0]} maxBarSize={22} activeBar={{ fill: '#3730A3' }}>
                <LabelList dataKey="registrations" position="right" fill="#0B1020" fontSize={13} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
