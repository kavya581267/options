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
  kotak: {
    accessToken: process.env.KOTAK_ACCESS_TOKEN || '',
    mobileNumber: process.env.KOTAK_MOBILE_NUMBER || '',
    ucc: process.env.KOTAK_UCC || '',
  },
  trading: {
    symbol: (process.env.TRADING_SYMBOL || 'NIFTY').toUpperCase(),
    side: (process.env.TRADING_SIDE || 'SELL').toUpperCase(),
    lots: parseInt(process.env.TRADING_LOTS || '1', 10),
    product: process.env.TRADING_PRODUCT || 'MIS',
    useBracketOrder: process.env.TRADING_USE_BO === 'true',
    slType: process.env.SL_TYPE || 'percent',
    slValue: parseFloat(process.env.SL_VALUE || '20'),
    targetType: process.env.TARGET_TYPE || 'percent',
    targetValue: parseFloat(process.env.TARGET_VALUE || '30'),
  },
};
