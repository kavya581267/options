import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import './StraddleChart.css';

function fmt(n, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toFixed(digits);
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  return (
    <div className="chart-tooltip">
      <p className="tooltip-time">{label} IST</p>
      <p className="tooltip-row spot">
        <span className="tooltip-dot" />
        Spot <strong>₹{fmt(row.spot)}</strong>
      </p>
      <p className="tooltip-row premium">
        <span className="tooltip-dot" />
        Straddle premium <strong>₹{fmt(row.premium)}</strong>
      </p>
    </div>
  );
}

export default function StraddleChart({
  data,
  symbol,
  anchorStrike,
  anchorSpot,
}) {
  const [hover, setHover] = useState(null);

  const chartData = useMemo(
    () =>
      data.map((r) => ({
        time: r.time?.slice(0, 5) ?? r.time,
        premium: r.straddlePremium,
        spot: r.spot != null && r.spot > 0 ? r.spot : null,
      })),
    [data]
  );

  const premiums = chartData.map((d) => d.premium).filter((v) => v != null);
  const spots = chartData.map((d) => d.spot).filter((v) => v != null);
  const premiumHigh = premiums.length ? Math.max(...premiums) : null;
  const premiumLow = premiums.length ? Math.min(...premiums) : null;
  const spotHigh = spots.length ? Math.max(...spots) : null;
  const spotLow = spots.length ? Math.min(...spots) : null;

  const display = hover ?? {
    time: chartData.length ? chartData[chartData.length - 1].time : '—',
    spot: spots.length ? spots[spots.length - 1] : null,
    premium: premiums.length ? premiums[premiums.length - 1] : null,
  };

  return (
    <section className="chart-section chart-section-combined">
      <div className="chart-header">
        <h2 className="section-title">
          {symbol} — Spot &amp; straddle premium
          {anchorStrike != null && (
            <span className="strike-badge">Strike {anchorStrike}</span>
          )}
        </h2>
        <p className="chart-hint">Move cursor over the chart to inspect both values</p>
      </div>

      <div className="hover-readout" aria-live="polite">
        <span className="readout-time">{display.time} IST</span>
        <span className="readout-item spot">
          Spot <strong>₹{fmt(display.spot)}</strong>
        </span>
        <span className="readout-item premium">
          Premium <strong>₹{fmt(display.premium)}</strong>
        </span>
      </div>

      <div className="chart-wrap chart-wrap-combined">
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 56, left: 56, bottom: 8 }}
            onMouseMove={(state) => {
              if (state?.activePayload?.[0]?.payload) {
                setHover(state.activePayload[0].payload);
              }
            }}
            onMouseLeave={() => setHover(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3348" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#8b95a8', fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="spot"
              orientation="left"
              domain={['auto', 'auto']}
              tick={{ fill: '#a78bfa', fontSize: 11 }}
              tickFormatter={(v) => v.toFixed(0)}
              label={{
                value: 'Spot (₹)',
                angle: -90,
                position: 'insideLeft',
                fill: '#a78bfa',
                style: { textAnchor: 'middle' },
              }}
            />
            <YAxis
              yAxisId="premium"
              orientation="right"
              domain={['auto', 'auto']}
              tick={{ fill: '#3b82f6', fontSize: 11 }}
              tickFormatter={(v) => v.toFixed(0)}
              label={{
                value: 'Premium (₹)',
                angle: 90,
                position: 'insideRight',
                fill: '#3b82f6',
                style: { textAnchor: 'middle' },
              }}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: '#8b95a8', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Legend
              verticalAlign="top"
              height={28}
              formatter={(value) =>
                value === 'spot' ? `${symbol} spot` : 'Straddle premium'
              }
            />
            {anchorSpot != null && anchorSpot > 0 && (
              <ReferenceLine
                yAxisId="spot"
                y={anchorSpot}
                stroke="#f59e0b"
                strokeDasharray="6 4"
                label={{
                  value: `9:15 ${anchorSpot.toFixed(0)}`,
                  fill: '#f59e0b',
                  fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />
            )}
            {spotHigh != null && (
              <ReferenceLine
                yAxisId="spot"
                y={spotHigh}
                stroke="#22c55e"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
            )}
            {spotLow != null && (
              <ReferenceLine
                yAxisId="spot"
                y={spotLow}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
            )}
            {premiumHigh != null && (
              <ReferenceLine
                yAxisId="premium"
                y={premiumHigh}
                stroke="#22c55e"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
            )}
            {premiumLow != null && (
              <ReferenceLine
                yAxisId="premium"
                y={premiumLow}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
            )}
            <Line
              yAxisId="spot"
              type="monotone"
              dataKey="spot"
              name="spot"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 5, fill: '#a78bfa' }}
            />
            <Line
              yAxisId="premium"
              type="monotone"
              dataKey="premium"
              name="premium"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: '#3b82f6' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
