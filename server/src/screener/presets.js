import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { normalizeQuery, queryId } from './query.js';

const PRESETS_FILE = () => path.join(config.dataDir, 'screener', 'presets.json');

function q(query) {
  return normalizeQuery({ logic: 'AND', universe: 'all', ...query });
}

const BUILTIN_PRESETS = [
  // ── Swing trading strategies ──
  {
    id: 'swing-trend-continuation',
    name: 'Swing: Trend continuation ★',
    category: 'swing',
    description:
      'Primary swing screen — price above EMA 50, EMA sloping up, healthy RSI (45–65), and volume ≥ 1.5× average. Best for riding ongoing uptrends.',
    query: q({
      indicators: [
        { id: 'price_vs_ema', params: { period: 50, operator: '>=' } },
        { id: 'ema_rising', params: { period: 50, lookback: 5, operator: '>' } },
        { id: 'rsi_range', params: { period: 14, min: 45, max: 65 } },
        { id: 'volume_spike', params: { lookback: 20, multiplier: 1.5 } },
      ],
    }),
    builtIn: true,
  },
  {
    id: 'swing-momentum',
    name: 'Swing: Short-term momentum',
    category: 'swing',
    description:
      'Faster swing setup — above EMA 20, short EMA rising, RSI ≥ 50, volume confirmation. For 3–7 day holds.',
    query: q({
      indicators: [
        { id: 'price_vs_ema', params: { period: 20, operator: '>=' } },
        { id: 'ema_rising', params: { period: 20, lookback: 3, operator: '>' } },
        { id: 'rsi', params: { period: 14, operator: '>=', threshold: 50 } },
        { id: 'volume_spike', params: { lookback: 20, multiplier: 1.5 } },
      ],
    }),
    builtIn: true,
  },
  {
    id: 'swing-pullback',
    name: 'Swing: Pullback in uptrend',
    category: 'swing',
    description:
      'Buy the dip — stock above EMA 50 with rising EMA but RSI cooled to ≤ 45. Look for reversal candle on chart before entry.',
    query: q({
      indicators: [
        { id: 'price_vs_ema', params: { period: 50, operator: '>=' } },
        { id: 'ema_rising', params: { period: 50, lookback: 5, operator: '>' } },
        { id: 'rsi', params: { period: 14, operator: '<=', threshold: 45 } },
      ],
    }),
    builtIn: true,
  },
  {
    id: 'swing-volume-breakout',
    name: 'Swing: Volume breakout',
    category: 'swing',
    description:
      'Strong participation — uptrend with EMA rising and volume ≥ 2× 20-day average. For breakout-style swings.',
    query: q({
      indicators: [
        { id: 'price_vs_ema', params: { period: 50, operator: '>=' } },
        { id: 'ema_rising', params: { period: 50, lookback: 5, operator: '>' } },
        { id: 'volume_spike', params: { lookback: 20, multiplier: 2 } },
      ],
    }),
    builtIn: true,
  },
  {
    id: 'swing-conservative',
    name: 'Swing: Conservative trend',
    category: 'swing',
    description:
      'Fewer, higher-quality names — above EMA 50 and SMA 200 proxy (SMA 50), EMA rising, no overbought RSI.',
    query: q({
      indicators: [
        { id: 'price_vs_ema', params: { period: 50, operator: '>=' } },
        { id: 'price_vs_sma', params: { period: 50, operator: '>=' } },
        { id: 'ema_rising', params: { period: 50, lookback: 5, operator: '>' } },
        { id: 'rsi_range', params: { period: 14, min: 40, max: 60 } },
      ],
    }),
    builtIn: true,
  },

  // ── General / legacy ──
  {
    id: 'ema50-above-rising',
    name: 'General: EMA 50 + rising',
    category: 'general',
    description: 'Simple trend filter — close above EMA 50 with upward-sloping EMA.',
    query: q({
      indicators: [
        { id: 'price_vs_ema', params: { period: 50, operator: '>=' } },
        { id: 'ema_rising', params: { period: 50, lookback: 5, operator: '>' } },
      ],
    }),
    builtIn: true,
  },
  {
    id: 'ema50-above',
    name: 'General: Price ≥ EMA 50',
    category: 'general',
    description: 'Basic filter — close at or above 50-day EMA only.',
    query: q({
      indicators: [{ id: 'price_vs_ema', params: { period: 50, operator: '>=' } }],
    }),
    builtIn: true,
  },
  {
    id: 'rsi-oversold-ema',
    name: 'General: RSI oversold + EMA 50',
    category: 'general',
    description: 'RSI ≤ 35 while still above EMA 50 — deep pullback candidates.',
    query: q({
      indicators: [
        { id: 'rsi', params: { period: 14, operator: '<=', threshold: 35 } },
        { id: 'price_vs_ema', params: { period: 50, operator: '>=' } },
      ],
    }),
    builtIn: true,
  },
];

async function readUserPresets() {
  try {
    const raw = await fs.readFile(PRESETS_FILE(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeUserPresets(presets) {
  await fs.mkdir(path.dirname(PRESETS_FILE()), { recursive: true });
  await fs.writeFile(PRESETS_FILE(), JSON.stringify(presets, null, 2), 'utf-8');
}

export async function listPresets() {
  const user = await readUserPresets();
  return [...BUILTIN_PRESETS, ...user].map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category || 'custom',
    description: p.description || '',
    builtIn: Boolean(p.builtIn),
    query: p.query,
    queryId: queryId(p.query),
  }));
}

export async function savePreset({ name, query, description }) {
  if (!name?.trim()) throw new Error('Preset name is required');
  const normalized = normalizeQuery(query);
  const user = await readUserPresets();
  const id = `user-${Date.now()}`;
  const preset = {
    id,
    name: name.trim(),
    category: 'custom',
    description: description?.trim() || '',
    query: normalized,
    builtIn: false,
  };
  user.push(preset);
  await writeUserPresets(user);
  return { ...preset, queryId: queryId(normalized) };
}

export async function deletePreset(id) {
  if (BUILTIN_PRESETS.some((p) => p.id === id)) {
    throw new Error('Cannot delete built-in preset');
  }
  const user = await readUserPresets();
  const next = user.filter((p) => p.id !== id);
  if (next.length === user.length) throw new Error('Preset not found');
  await writeUserPresets(next);
  return { ok: true };
}

export async function getPreset(id) {
  const all = await listPresets();
  return all.find((p) => p.id === id) || null;
}
