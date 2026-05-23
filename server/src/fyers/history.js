import { fyersGet } from './client.js';

/**
 * Daily OHLC candles from Fyers data API.
 * Candles: [timestamp, open, high, low, close, volume]
 */
export async function fetchDailyHistory(symbol, rangeFrom, rangeTo) {
  const data = await fyersGet('/history', {
    symbol,
    resolution: 'D',
    date_format: '1',
    range_from: rangeFrom,
    range_to: rangeTo,
    cont_flag: '1',
  });
  return data.candles || [];
}
