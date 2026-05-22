const INDEX = {
  NIFTY: 'NSE:NIFTY50-INDEX',
  SENSEX: 'BSE:SENSEX-INDEX',
};

const CHAIN = {
  NIFTY: 'NSE:NIFTY50-INDEX',
  SENSEX: 'BSE:SENSEX-INDEX',
};

export function indexSymbol(symbol) {
  const sym = symbol.toUpperCase();
  if (!INDEX[sym]) throw new Error(`Fyers index not configured for ${sym}`);
  return INDEX[sym];
}

export function optionChainSymbol(symbol) {
  return indexSymbol(symbol);
}

export function atmStrikeFromSpot(spot, symbol) {
  const step = symbol.toUpperCase() === 'SENSEX' ? 100 : 50;
  return Math.round(Number(spot) / step) * step;
}
