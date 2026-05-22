export default function FyersSessionPanel({
  loggedIn,
  authCode,
  setAuthCode,
  authUrl,
  busy,
  onGetUrl,
  onLogin,
  onLogout,
}) {
  if (loggedIn) {
    return (
      <section className="kotak-section session-compact">
        <div className="kotak-row">
          <span className="ok">Fyers session ready</span>
          <button type="button" disabled={busy} onClick={onLogout}>
            Logout
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="kotak-section session-compact">
      <h2 className="section-title">Session (OAuth)</h2>
      <div className="kotak-row">
        <button type="button" disabled={busy} onClick={onGetUrl}>
          Get login URL
        </button>
        {authUrl && (
          <a href={authUrl} target="_blank" rel="noreferrer" className="ok">
            Open Fyers login
          </a>
        )}
      </div>
      <p className="kotak-hint">
        After login, paste <code>auth_code</code> from the redirect URL (or open the Fyers tab
        — it auto-completes).
      </p>
      <div className="kotak-row">
        <input
          type="text"
          placeholder="auth_code"
          value={authCode}
          onChange={(e) => setAuthCode(e.target.value)}
          style={{ minWidth: 280, flex: 1 }}
        />
        <button type="button" disabled={busy || !authCode.trim()} onClick={onLogin}>
          Complete login
        </button>
      </div>
    </section>
  );
}
