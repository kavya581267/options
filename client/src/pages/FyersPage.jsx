import { useEffect, useRef, useState } from 'react';
import BrokerTradingPage from './BrokerTradingPage';
import FyersSessionPanel from '../components/broker/FyersSessionPanel';
import { fyersStrategyApi } from '../api/fyersTrading';
import * as api from '../api/fyersTrading';

function FyersOAuthBridge({ children }) {
  const [authCode, setAuthCode] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const oauthAttempted = useRef(false);
  const [oauthBusy, setOauthBusy] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('auth_code');
    if (fromUrl) setAuthCode(fromUrl);
  }, []);

  const tryAutoLogin = async (run) => {
    const code =
      new URLSearchParams(window.location.search).get('auth_code') ||
      authCode.trim();
    if (!code || oauthAttempted.current) return;
    oauthAttempted.current = true;
    setOauthBusy(true);
    try {
      await api.fyersLoginAuthCode(code);
      window.history.replaceState({}, '', window.location.pathname);
      await run();
    } catch {
      oauthAttempted.current = false;
    } finally {
      setOauthBusy(false);
    }
  };

  return children({ authCode, setAuthCode, authUrl, setAuthUrl, tryAutoLogin, oauthBusy });
}

export default function FyersPage() {
  return (
    <FyersOAuthBridge>
      {({ authCode, setAuthCode, authUrl, setAuthUrl, tryAutoLogin, oauthBusy }) => (
        <BrokerTradingPage
          brokerId="fyers"
          brokerName="Fyers"
          api={{
            fetchConfig: api.fetchFyersConfig,
            fetchSession: api.fetchFyersSession,
            fetchSchedule: api.fetchFyersSchedule,
            saveSchedule: api.saveFyersSchedule,
            resetScheduleToday: api.resetFyersScheduleToday,
            runScheduleNow: api.runFyersScheduleNow,
            fetchStraddleQuote: api.fetchFyersStraddleQuote,
            fetchTrackerAnchor: api.fetchFyersTrackerAnchor,
            fetchOpenTrades: api.fetchFyersOpenTrades,
            fetchLiveTrade: api.fetchFyersLiveTrade,
            fetchTradeStatus: api.fetchFyersTradeStatus,
            previewLevels: api.previewFyersLevels,
            enter: api.fyersEnter,
            exit: api.fyersExit,
            monitor: api.fyersMonitor,
          }}
          strategyApi={fyersStrategyApi}
          subtitle="Straddle strategies via Fyers API — OAuth login, schedule, and software SL/target."
          docsLink="https://myapi.fyers.in/docsv3"
          docsLabel="Fyers API v3"
          envHint={
            <>
              Set <code>FYERS_API_KEY</code>, <code>FYERS_API_SECRET</code>,{' '}
              <code>FYERS_REDIRECT_URI</code> in <code>server/.env</code>.
            </>
          }
          configuredWarn="Set FYERS_API_KEY and FYERS_API_SECRET in server/.env"
          unavailableMsg="Fyers API unavailable. Restart the server and confirm: Fyers trading API: /api/fyers"
          onReady={tryAutoLogin}
          renderSession={({ loggedIn, busy, run }) => {
            if (!loggedIn && authCode && !oauthBusy) {
              tryAutoLogin(run);
            }
            return (
              <FyersSessionPanel
                loggedIn={loggedIn}
                authCode={authCode}
                setAuthCode={setAuthCode}
                authUrl={authUrl}
                busy={busy || oauthBusy}
                onGetUrl={async () => {
                  const { url } = await api.fetchFyersAuthUrl();
                  setAuthUrl(url);
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                onLogin={() => run(() => api.fyersLoginAuthCode(authCode.trim()))}
                onLogout={() => run(api.fyersLogout)}
              />
            );
          }}
        />
      )}
    </FyersOAuthBridge>
  );
}
