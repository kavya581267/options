import fs from 'fs/promises';
import { getNseClient } from './exchangeClients.js';

function parseCsvLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
}

export function parseDeliveryBhavcopyText(raw) {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return {};

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const bySymbol = {};

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, cols[idx[h]] ?? '']));
    const symbol = String(row.SYMBOL || '').trim().toUpperCase();
    const series = String(row.SERIES || '').trim().toUpperCase();
    if (!symbol || series !== 'EQ') continue;

    bySymbol[symbol] = {
      delivery_qty: Number(row.DELIV_QTY ?? 0),
      delivery_pct: Number(row.DELIV_PER ?? 0),
    };
  }

  return bySymbol;
}

export async function parseDeliveryBhavcopyFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return parseDeliveryBhavcopyText(raw);
}

export async function downloadNseDeliveryBhavcopy(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  const nse = getNseClient();
  return nse.download.downloadDeliveryBhavcopy(date);
}

export async function loadNseDeliveryMap(dateStr) {
  try {
    const filePath = await downloadNseDeliveryBhavcopy(dateStr);
    return await parseDeliveryBhavcopyFile(filePath);
  } catch {
    return null;
  }
}

export function mergeDeliveryIntoSymbols(symbols, deliveryMap) {
  if (!deliveryMap || !symbols) return symbols;

  for (const [sym, entry] of Object.entries(symbols)) {
    const delivery = deliveryMap[sym];
    if (!delivery) continue;
    entry.delivery_qty = delivery.delivery_qty;
    entry.delivery_pct = delivery.delivery_pct;
  }

  return symbols;
}
