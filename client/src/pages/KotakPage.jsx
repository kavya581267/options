import { useState } from 'react';
import BrokerTradingPage from './BrokerTradingPage';
import KotakSessionPanel from '../components/broker/KotakSessionPanel';
import { kotakStrategyApi } from '../api/trading';
import * as api from '../api/trading';

export default function KotakPage() {
  const [totp, setTotp] = useState('');
  const [mpin, setMpin] = useState('');

  return (
    <BrokerTradingPage
      brokerId="kotak"
      brokerName="Kotak Neo"
      api={{
        fetchConfig: api.fetchTradingConfig,
        fetchSession: api.fetchTradingSession,
        fetchSchedule: api.fetchSchedule,
        saveSchedule: api.saveSchedule,
        resetScheduleToday: api.resetScheduleToday,
        runScheduleNow: api.runScheduleNow,
        fetchStraddleQuote: api.fetchStraddleQuote,
        fetchTrackerAnchor: api.fetchTrackerAnchor,
        fetchOpenTrades: api.fetchOpenTrades,
        fetchLiveTrade: api.fetchLiveTrade,
        fetchTradeStatus: api.fetchTradeStatus,
        previewLevels: api.previewLevels,
        enter: api.tradingEnter,
        exit: api.tradingExit,
        monitor: api.tradingMonitor,
      }}
      strategyApi={kotakStrategyApi}
      subtitle="Straddle strategies with scheduled entry, live quotes, and SL/target on total premium."
      docsLink="https://1q09.github.io/Kotak-neo-api-v2/?theme=light#login-with-totp"
      docsLabel="Kotak Neo API v2"
      envHint={
        <>
          Set <code>KOTAK_*</code> in <code>server/.env</code>.
        </>
      }
      configuredWarn="Set KOTAK_ACCESS_TOKEN in server/.env"
      unavailableMsg="Kotak API unavailable. Restart the server and confirm: Kotak trading API: /api/trading"
      renderSession={({ loggedIn, busy, run }) => (
        <KotakSessionPanel
          loggedIn={loggedIn}
          totp={totp}
          setTotp={setTotp}
          mpin={mpin}
          setMpin={setMpin}
          busy={busy}
          onTotp={() => run(() => api.kotakLoginTotp(totp))}
          onMpin={() => run(() => api.kotakLoginMpin(mpin))}
          onLogout={() => run(api.kotakLogout)}
        />
      )}
    />
  );
}
