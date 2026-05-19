import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  dataDir: path.resolve(
    process.env.DATA_DIR || path.join(__dirname, '..', 'data')
  ),
  symbols: (process.env.SYMBOLS || 'NIFTY,SENSEX')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
  /** Market open / anchor capture time (IST) */
  marketStart: process.env.MARKET_START || '09:15',
  marketEnd: process.env.MARKET_END || '15:30',
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  forceFetch: process.env.FORCE_FETCH === 'true',
};
