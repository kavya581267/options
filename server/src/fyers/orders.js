import { fyersPostApi } from './client.js';

const PRODUCT_MAP = {
  MIS: 'INTRADAY',
  NRML: 'MARGIN',
  CNC: 'CNC',
};

/** Fyers: 1 = limit, 2 = market */
const ORDER_TYPE = { MKT: 2, L: 1 };

/** Fyers: 1 = buy, -1 = sell */
function sideCode(txn) {
  return txn === 'B' || txn === 'BUY' ? 1 : -1;
}

export async function placeOrder(params) {
  const productType = PRODUCT_MAP[params.product] || params.product || 'INTRADAY';
  const body = {
    symbol: params.fyersSymbol || params.tradingSymbol,
    qty: parseInt(params.quantity, 10),
    type: ORDER_TYPE[params.orderType] || 2,
    side: sideCode(params.transactionType),
    productType,
    limitPrice: parseFloat(params.price || 0),
    stopPrice: 0,
    validity: params.validity || 'DAY',
    disclosedQty: 0,
    offlineOrder: false,
    orderTag: params.orderTag || 'options-straddle',
  };

  const data = await fyersPostApi('/orders/sync', body);
  return {
    nOrdNo: data.id || data.orderId || data.order_id,
    ...data,
  };
}

export async function cancelOrder(orderId) {
  return fyersPostApi('/orders/sync', {
    id: String(orderId),
    type: -1,
  });
}
