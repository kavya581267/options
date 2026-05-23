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
  fyers: {
    appId:
      process.env.FYERS_APP_ID ||
      process.env.FYERS_API_KEY ||
      process.env.FYERS_CLIENT_ID ||
      '',
    secretKey:
      process.env.FYERS_SECRET_KEY ||
      process.env.FYERS_API_SECRET ||
      process.env.FYERS_SECRET ||
      '',
    redirectUri:
      process.env.FYERS_REDIRECT_URI ||
      process.env.FYERS_REDIRECT_URL ||
      'http://127.0.0.1:5173/',
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
  fyersTrading: {
    symbol: (process.env.FYERS_TRADING_SYMBOL || process.env.TRADING_SYMBOL || 'NIFTY').toUpperCase(),
    side: (process.env.FYERS_TRADING_SIDE || process.env.TRADING_SIDE || 'SELL').toUpperCase(),
    lots: parseInt(process.env.FYERS_TRADING_LOTS || process.env.TRADING_LOTS || '1', 10),
    product: process.env.FYERS_TRADING_PRODUCT || process.env.TRADING_PRODUCT || 'MIS',
    slType: process.env.FYERS_SL_TYPE || process.env.SL_TYPE || 'percent',
    slValue: parseFloat(process.env.FYERS_SL_VALUE || process.env.SL_VALUE || '20'),
    targetType: process.env.FYERS_TARGET_TYPE || process.env.TARGET_TYPE || 'percent',
    targetValue: parseFloat(
      process.env.FYERS_TARGET_VALUE || process.env.TARGET_VALUE || '30'
    ),
  },
  screener: {
    defaultUniverse: process.env.SCREENER_UNIVERSE || 'all',
    requestDelayMs: parseInt(process.env.SCREENER_DELAY_MS || '50', 10),
    autoRun: process.env.SCREENER_AUTO_RUN !== 'false',
    autoRunTime: process.env.SCREENER_AUTO_RUN_TIME || '16:00',
  },
};
