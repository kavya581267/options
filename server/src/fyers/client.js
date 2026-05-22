import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

const API_ROOT = 'https://api-t1.fyers.in/api/v3';
const DATA_ROOT = 'https://api-t1.fyers.in/data-rest/v3';

let session = null;

function sessionPath() {
  return path.join(config.dataDir, 'fyers-session.json');
}

export function getSession() {
  return session;
}

export function isLoggedIn() {
  return Boolean(session?.accessToken && config.fyers.appId);
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

function appIdHash() {
  const { appId, secretKey } = config.fyers;
  return crypto.createHash('sha256').update(`${appId}:${secretKey}`).digest('hex');
}

/** OAuth login URL — open in browser, then paste auth code. */
export function getAuthUrl(state = 'options-app') {
  const { appId, redirectUri } = config.fyers;
  if (!appId) {
    throw new Error(
      'Fyers app id missing in server/.env — set FYERS_APP_ID or FYERS_API_KEY'
    );
  }
  if (!redirectUri) {
    throw new Error(
      'Fyers redirect missing — set FYERS_REDIRECT_URI (must match Fyers dashboard)'
    );
  }
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return `${API_ROOT}/generate-authcode?${params}`;
}

export async function exchangeAuthCode(authCode) {
  const { appId, secretKey } = config.fyers;
  if (!secretKey) {
    throw new Error('Fyers secret missing — set FYERS_API_SECRET or FYERS_SECRET_KEY in server/.env');
  }
  let data;
  try {
    ({ data } = await axios.post(
      `${API_ROOT}/validate-authcode`,
      {
        grant_type: 'authorization_code',
        appIdHash: appIdHash(),
        code: String(authCode).trim(),
      },
      { headers: { 'Content-Type': 'application/json' } }
    ));
  } catch (err) {
    const msg =
      err.response?.data?.message ||
      err.response?.data?.error_description ||
      err.message;
    throw new Error(msg || 'Fyers validate-authcode failed');
  }

  if (data.s !== 'ok' || !data.access_token) {
    throw new Error(data.message || data.error_description || 'Fyers auth failed');
  }

  const next = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    appId,
    profile: data.name || null,
    at: new Date().toISOString(),
  };
  await saveSession(next);
  return next;
}

export function authHeader() {
  if (!isLoggedIn()) {
    throw new Error('Fyers not logged in. Complete OAuth login on the Fyers page.');
  }
  return `${config.fyers.appId}:${session.accessToken}`;
}

export async function fyersGet(urlPath, params = {}) {
  const { data } = await axios.get(`${DATA_ROOT}${urlPath}`, {
    headers: { Authorization: authHeader() },
    params,
  });
  if (data.s === 'error' || data.s === 'not_ok') {
    throw new Error(data.message || 'Fyers API error');
  }
  return data;
}

export async function fyersPostApi(urlPath, body) {
  const { data } = await axios.post(`${API_ROOT}${urlPath}`, body, {
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
  });
  if (data.s === 'error' || data.s === 'not_ok') {
    throw new Error(data.message || JSON.stringify(data) || 'Fyers API error');
  }
  return data;
}

export { API_ROOT, DATA_ROOT };

await loadSession();
