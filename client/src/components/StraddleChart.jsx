import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import './StraddleChart.css';

export default function StraddleChart({ data, symbol, anchorStrike }) {
  const chartData = data.map((r) => ({
    time: r.time?.slice(0, 5) ?? r.time,
    premium: r.straddlePremium,
  }));

  const premiums = chartData.map((d) => d.premium);
  const high = Math.max(...premiums);
  const low = Math.min(...premiums);

  return (
    <section className="chart-section">
      <h2 className="section-title">
        {symbol} — Time vs premium
        {anchorStrike != null && (
          <span className="strike-badge">Strike {anchorStrike}</span>
        )}
      </h2>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3348" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#8b95a8', fontSize: 11 }}
              interval="preserveStartEnd"
              label={{ value: 'Time', position: 'insideBottom', offset: -4, fill: '#8b95a8' }}
            />
            <YAxis
              tick={{ fill: '#8b95a8', fontSize: 11 }}
              domain={['auto', 'auto']}
              tickFormatter={(v) => v.toFixed(0)}
              label={{
                value: 'Premium (₹)',
                angle: -90,
                position: 'insideLeft',
                fill: '#8b95a8',
                style: { textAnchor: 'middle' },
              }}
            />
            <Tooltip
              contentStyle={{
                background: '#141820',
                border: '1px solid #2a3348',
                borderRadius: 8,
              }}
              labelStyle={{ color: '#8b95a8' }}
              formatter={(value) => [Number(value).toFixed(2), 'Premium']}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <ReferenceLine
              y={high}
              stroke="#22c55e"
              strokeDasharray="4 4"
              label={{ value: `High ${high.toFixed(2)}`, fill: '#22c55e', fontSize: 11 }}
            />
            <ReferenceLine
              y={low}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: `Low ${low.toFixed(2)}`, fill: '#ef4444', fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="premium"
              name="Straddle premium"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
