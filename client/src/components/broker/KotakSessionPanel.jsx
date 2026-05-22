export default function KotakSessionPanel({ loggedIn, totp, setTotp, mpin, setMpin, busy, onTotp, onMpin, onLogout }) {
  if (loggedIn) {
    return (
      <section className="kotak-section session-compact">
        <div className="kotak-row">
          <span className="ok">Kotak trade session ready</span>
          <button type="button" disabled={busy} onClick={onLogout}>
            Logout
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="kotak-section session-compact">
      <h2 className="section-title">Session</h2>
      <div className="kotak-row">
        <input
          type="text"
          inputMode="numeric"
          placeholder="6-digit TOTP"
          value={totp}
          onChange={(e) => setTotp(e.target.value)}
          maxLength={6}
        />
        <button type="button" disabled={busy || totp.length < 6} onClick={onTotp}>
          Login TOTP
        </button>
        <input
          type="password"
          inputMode="numeric"
          placeholder="MPIN"
          value={mpin}
          onChange={(e) => setMpin(e.target.value)}
          maxLength={6}
        />
        <button type="button" disabled={busy || mpin.length < 4} onClick={onMpin}>
          Validate MPIN
        </button>
      </div>
    </section>
  );
}
