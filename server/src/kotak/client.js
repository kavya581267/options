import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

const LOGIN_BASE = 'https://mis.kotaksecurities.com';
const NEO_FIN_KEY = 'neotradeapi';

let session = null;

function sessionPath() {
  return path.join(config.dataDir, 'kotak-session.json');
}

export function getSession() {
  return session;
}

export function isLoggedIn() {
  return Boolean(session?.tradeToken && session?.baseUrl);
}

export async function loadSession() {
  try {
    const raw = await fs.readFile(sessionPath(), 'utf-8');
    session = JSON.parse(raw);
    return session;
  } catch {
    return null;
  }
}

export async function saveSession(s) {
  session = s;
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(sessionPath(), JSON.stringify(s, null, 2), 'utf-8');
}

export async function clearSession() {
  session = null;
  try {
    await fs.unlink(sessionPath());
  } catch {
    /* ignore */
  }
}

export function authHeaders() {
  if (!config.kotak.accessToken) {
    throw new Error('KOTAK_ACCESS_TOKEN not set in server/.env');
  }
  return {
    Authorization: config.kotak.accessToken,
    'neo-fin-key': NEO_FIN_KEY,
    Accept: 'application/json',
  };
}

function tradeHeaders() {
  if (!isLoggedIn()) {
    throw new Error('Kotak session not active. Login with TOTP + MPIN first.');
  }
  return {
    Authorization: config.kotak.accessToken,
    'neo-fin-key': NEO_FIN_KEY,
    Sid: session.tradeSid,
    Auth: session.tradeToken,
    Accept: 'application/json',
  };
}

export async function loginTotp(totp, mobileNumber, ucc) {
  const mobile = mobileNumber || config.kotak.mobileNumber;
  const clientCode = ucc || config.kotak.ucc;
  if (!mobile || !clientCode) {
    throw new Error('KOTAK_MOBILE_NUMBER and KOTAK_UCC required in server/.env');
  }

  const { data } = await axios.post(
    `${LOGIN_BASE}/login/1.0/tradeApiLogin`,
    { mobileNumber: mobile, ucc: clientCode, totp: String(totp) },
    { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
  );

  const payload = data?.data;
  if (!payload?.token || !payload?.sid) {
    throw new Error(data?.message || 'TOTP login failed');
  }

  const partial = {
    viewToken: payload.token,
    viewSid: payload.sid,
    greetingName: payload.greetingName,
  };
  await saveSession({ ...session, ...partial });
  return partial;
}

export async function validateMpin(mpin) {
  if (!session?.viewToken || !session?.viewSid) {
    throw new Error('Complete TOTP login first');
  }

  const { data } = await axios.post(
    `${LOGIN_BASE}/login/1.0/tradeApiValidate`,
    { mpin: String(mpin) },
    {
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
        sid: session.viewSid,
        Auth: session.viewToken,
      },
    }
  );

  const payload = data?.data;
  if (!payload?.token || payload?.status !== 'success') {
    throw new Error(data?.message || 'MPIN validation failed');
  }

  const next = {
    ...session,
    tradeToken: payload.token,
    tradeSid: payload.sid,
    tradeRid: payload.rid || null,
    hsServerId:
      payload.hsServerId ||
      session?.hsServerId ||
      payload.dataCenter ||
      null,
    dataCenter: payload.dataCenter || null,
    baseUrl: (payload.baseUrl || 'https://cis.kotaksecurities.com').replace(
      /\/$/,
      ''
    ),
    greetingName: payload.greetingName || session.greetingName,
  };
  await saveSession(next);
  return {
    loggedIn: true,
    greetingName: next.greetingName,
    baseUrl: next.baseUrl,
  };
}

export async function kotakRequest(method, pathSuffix, body, query = {}) {
  const headers = tradeHeaders();
  const url = `${session.baseUrl}/${pathSuffix.replace(/^\//, '')}`;
  const { data } = await axios({
    method,
    url,
    headers:
      method === 'POST' && body && !(body instanceof URLSearchParams)
        ? { ...headers, 'Content-Type': 'application/json' }
        : headers,
    data: body,
    params: query,
  });
  return data;
}

await loadSession();
