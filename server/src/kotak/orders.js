import axios from 'axios';
import qs from 'qs';
import { config } from '../config.js';
import { getSession, isLoggedIn } from './client.js';

function tradeHeaders() {
  if (!isLoggedIn()) {
    throw new Error('Kotak session not active. Login with TOTP + MPIN first.');
  }
  const session = getSession();
  return {
    Authorization: config.kotak.accessToken,
    'neo-fin-key': 'neotradeapi',
    Sid: session.tradeSid,
    Auth: session.tradeToken,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

/**
 * Place order via Kotak Neo API v2
 * @see https://1q09.github.io/Kotak-neo-api-v2/
 */
export async function placeOrder(params) {
  const session = getSession();
  const body = qs.stringify({
    es: params.exchangeSegment,
    pc: params.product,
    pr: params.price ?? '0',
    pt: params.orderType || 'MKT',
    qt: String(params.quantity),
    rt: params.validity || 'DAY',
    ts: params.tradingSymbol,
    tt: params.transactionType,
    am: params.amo || 'NO',
    dq: params.disclosedQuantity || '0',
    mp: params.marketProtection || '0',
    pf: params.pf || 'N',
    tp: params.triggerPrice || '0',
    tk: params.scripToken,
    sot: params.squareOffType,
    slt: params.stopLossType,
    slv: params.stopLossValue,
    sov: params.squareOffValue,
    lat: params.lastTradedPrice,
    tlt: params.trailingStopLoss,
    tsv: params.trailingSlValue,
  });

  const { data } = await axios.post(
    `${session.baseUrl}/quick/order/rule/ms/place`,
    body,
    { headers: tradeHeaders(), params: { sId: 'server1' } }
  );
  return data;
}

export async function cancelOrder(orderId) {
  const session = getSession();
  const body = qs.stringify({ on: String(orderId) });
  const { data } = await axios.post(
    `${session.baseUrl}/quick/order/cancel`,
    body,
    { headers: tradeHeaders(), params: { sId: 'server1' } }
  );
  return data;
}
