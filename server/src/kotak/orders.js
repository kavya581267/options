import axios from 'axios';
import qs from 'qs';
import { getSession, isLoggedIn } from './client.js';

const ORDER_SOURCE = 'NEOTRADEAPI';

function tradeHeaders() {
  if (!isLoggedIn()) {
    throw new Error('Kotak session not active. Login with TOTP + MPIN first.');
  }
  const session = getSession();
  return {
    'neo-fin-key': 'neotradeapi',
    Sid: session.tradeSid,
    Auth: session.tradeToken,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

function serverIdParam() {
  const session = getSession();
  const sId = session?.hsServerId || session?.dataCenter || 'server1';
  return sId ? { sId: String(sId) } : {};
}

function kotakOrderError(data, status) {
  const msg = data?.errMsg || data?.message || data?.stat || 'Order rejected';
  const code = data?.stCode != null ? ` (${data.stCode})` : status ? ` (HTTP ${status})` : '';
  let hint = '';
  if (data?.stCode === 100008) {
    hint =
      ' — Kotak blocks Place/Cancel order APIs unless your public IP is whitelisted in Neo app (More → Trade API → Add IP). ' +
      'Quotes work without this; orders do not. Re-login from the same machine after whitelisting.';
  } else if (data?.stCode === 1007) {
    hint = ' — order request format error (should be fixed after server restart)';
  }
  return new Error(`${msg}${code}${hint}`);
}

/**
 * Place order via Kotak Neo API v2.
 * Body must be form field jData = JSON string (not flat form fields).
 * @see https://github.com/Kotak-Neo/Kotak-neo-api-v2
 */
export async function placeOrder(params) {
  const session = getSession();

  const jData = {
    am: params.amo || 'NO',
    dq: params.disclosedQuantity || '0',
    es: params.exchangeSegment,
    mp: params.marketProtection || '0',
    pc: params.product,
    pf: params.pf || 'N',
    pr: params.price ?? '0',
    pt: params.orderType || 'MKT',
    qt: String(params.quantity),
    rt: params.validity || 'DAY',
    tp: params.triggerPrice || '0',
    ts: params.tradingSymbol,
    tt: params.transactionType,
    os: params.orderSource || ORDER_SOURCE,
  };

  if (params.scripToken) jData.tk = String(params.scripToken);
  if (params.tag) jData.ig = params.tag;
  if (params.squareOffType) jData.sot = params.squareOffType;
  if (params.stopLossType) jData.slt = params.stopLossType;
  if (params.stopLossValue) jData.slv = params.stopLossValue;
  if (params.squareOffValue) jData.sov = params.squareOffValue;
  if (params.lastTradedPrice) jData.lat = params.lastTradedPrice;
  if (params.trailingStopLoss) jData.tlt = params.trailingStopLoss;
  if (params.trailingSlValue) jData.tsv = params.trailingSlValue;

  const body = qs.stringify({ jData: JSON.stringify(jData) });

  try {
    const { data, status } = await axios.post(
      `${session.baseUrl}/quick/order/rule/ms/place`,
      body,
      { headers: tradeHeaders(), params: serverIdParam() }
    );

    if (data?.stat && String(data.stat).toLowerCase() !== 'ok') {
      throw kotakOrderError(data, status);
    }
    return data;
  } catch (err) {
    if (err.response?.data) {
      throw kotakOrderError(err.response.data, err.response.status);
    }
    throw err;
  }
}

export async function cancelOrder(orderId) {
  const session = getSession();
  const body = qs.stringify({ jData: JSON.stringify({ on: String(orderId) }) });

  try {
    const { data, status } = await axios.post(
      `${session.baseUrl}/quick/order/cancel`,
      body,
      { headers: tradeHeaders(), params: serverIdParam() }
    );
    if (data?.stat && String(data.stat).toLowerCase() !== 'ok') {
      throw kotakOrderError(data, status);
    }
    return data;
  } catch (err) {
    if (err.response?.data) {
      throw kotakOrderError(err.response.data, err.response.status);
    }
    throw err;
  }
}
