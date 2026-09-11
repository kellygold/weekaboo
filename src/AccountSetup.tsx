import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { useServices } from './services/context';
import type { Account, AccountSetupInfo, ConnectAccount, PendingCalendarWrite } from './services/contracts';
import { calendarProviders, providerName } from './calendar-providers';



export function AccountSetup({ close, calendars, removeId }: { close: () => void; calendars: () => void; removeId?: string }) {
  const { accounts: service, calendars: calendarService } = useServices();
  const [pendingWrites, setPendingWrites] = useState<PendingCalendarWrite[]>([]);
  const [dismissing, setDismissing] = useState<string>();
  const ref = useRef<HTMLDialogElement>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ready, setReady] = useState(false);
  const [setupInfo, setSetupInfo] = useState<AccountSetupInfo>();
  const [googleReady, setGoogleReady] = useState(false);
  const [icloudReady, setIcloudReady] = useState(false);
  const [microsoftReady, setMicrosoftReady] = useState(false);
  const [microsoft, setMicrosoft] = useState(false);
  const [sharedWork, setSharedWork] = useState(false);
  const [apple, setApple] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const connecting = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const [slowConnection, setSlowConnection] = useState(false);
  const [connection, setConnection] = useState<{provider: ConnectAccount['provider']; state: 'connecting' | 'redirecting' | 'connected'}>();
  const [error, setError] = useState('');
  const [callbackDismissed, setCallbackDismissed] = useState(false);
  const [removing, setRemoving] = useState<string | undefined>(removeId);
  useEffect(() => { if (ready && removeId) ref.current?.querySelector<HTMLElement>('.disconnect-confirm')?.scrollIntoView({ block: 'center' }); }, [ready, removeId]);
  const params = new URLSearchParams(location.search);
  const messages: Record<string, string> = { microsoft_cancelled: 'Microsoft connection was cancelled. You can try again.', microsoft_connection: 'Microsoft could not finish connecting. Allow calendar access when signing in, or check the app credentials if this continues.', google_cancelled: 'Google connection was cancelled. You can try again.', calendar_permission: 'Google Calendar permission is needed to connect.', google_connection: 'Google could not finish connecting. Please try again.', calendar_discovery: 'The account connected, but its calendars could not be listed yet. Try syncing again.' };
  async function load() {
    try {
      const [rows, setup] = await Promise.all([service.list(), service.availability()]);
      if (service.setupInfo) setSetupInfo(await service.setupInfo());
      setPendingWrites(await calendarService.pendingWrites?.() || []);
      setAccounts(rows); setIcloudReady(setup.icloud); setGoogleReady(setup.google); setMicrosoftReady(Boolean(setup.microsoft)); setReady(true);
      return rows;
    } catch (e) { setError((e as Error).message); }
  }
  async function resolveWrite(id: string, action: 'check' | 'dismiss') {
    setBusy(true); setError('');
    try { await calendarService.resolveWrite?.(id, action); setDismissing(undefined); }
    catch (e) { setError((e as Error).message); }
    finally { await load(); setBusy(false); }
  }
  async function connect(request: ConnectAccount) {
    if (busy || connecting.current) return;
    connecting.current = true;
    setCallbackDismissed(true);
    setBusy(true);
    setCancelling(false); setSlowConnection(false);
    setError('');
    setConnection({provider: request.provider, state: 'connecting'});
    let redirecting = false;
    try {
      redirecting = await service.connect(request) === 'redirecting';
      if (redirecting) { setConnection({provider: request.provider, state: 'redirecting'}); return; }
      const rows = await load();
      if (rows?.some(account => account.provider === request.provider && account.status === 'active')) {
        setConnection({provider: request.provider, state: 'connected'});
        setApple(false); setMicrosoft(false);
      } else {
        setConnection(undefined);
        if (rows) setError('The connection finished, but the account is not visible yet. Close this panel and refresh to check it.');
      }
    } catch (e) {
      setError((e as Error).message);
      setConnection(undefined);
    } finally {
      setPassword('');
      connecting.current = false; setBusy(false); setCancelling(false);
    }
  }
  async function cancelConnection() {
    if (!service.cancelConnection || cancelling) return;
    setCancelling(true);
    try { await service.cancelConnection(); }
    catch { setCancelling(false); setError('Could not stop sign-in yet. Close the sign-in window or wait for it to finish.'); }
  }
  useEffect(() => {
    setSlowConnection(false);
    if (connection?.state !== 'connecting') return;
    const timer = window.setTimeout(() => setSlowConnection(true), 15000);
    return () => window.clearTimeout(timer);
  }, [connection?.state, connection?.provider]);
  useEffect(() => { ref.current?.showModal(); void load(); }, []);
  useEffect(() => {
    const returned = (event: PageTransitionEvent) => {
      if (event.persisted && connection?.state === 'redirecting') {
        setConnection(undefined); setError('Sign-in was not completed. You can try again.');
      }
    };
    window.addEventListener('pageshow', returned);
    return () => window.removeEventListener('pageshow', returned);
  }, [connection?.state]);
  return <dialog ref={ref} className="calendar-drawer account-setup" aria-label="Connected accounts" onCancel={e => { if (busy) e.preventDefault(); else close(); }} onClick={e => { if (e.target === ref.current && !busy) close(); }}>
    <div className="drawer-head"><div><button className="icon" aria-label="Back to calendars" disabled={busy} onClick={calendars}><ArrowLeft size={18} /></button><h2>Connected accounts</h2></div><button className="icon" aria-label="Close accounts" disabled={busy} onClick={close}><X size={20} /></button></div>
    <div className="drawer-body"><p className="muted">Connect an account, then choose which calendars to use. Add as many accounts as you need.</p>
      <div className="account-connection-status" role="status" aria-live="polite" aria-atomic="true">
        {connection ? <div className="connection-feedback" data-state={connection.state}>
          {connection.state !== 'connected' ? <LoaderCircle className="connection-spinner" size={22} aria-hidden="true" /> : <CheckCircle2 size={22} aria-hidden="true" />}
          <div><strong>{cancelling ? 'Stopping connection…' : providerName(connection.provider) + (connection.state !== 'connected' ? ' is connecting…' : ' connected')}</strong><p>{cancelling ? 'Finishing the current check. Your existing accounts will stay connected.' : connection.state === 'connected' ? 'Your account is ready. Choose which calendars to show.' : slowConnection ? (connection.provider === 'icloud' ? 'iCloud is taking a little longer to respond. We’re still checking your calendars.' : service.cancelConnection ? 'Still waiting for sign-in. If the browser showed an error, cancel here before trying again.' : 'Still waiting for sign-in. If it showed an error, close the sign-in window before trying again.') : 'Complete sign-in if prompted. We’re checking access and finding your calendars.'}</p>{busy && connection.state === 'connecting' && connection.provider !== 'icloud' && service.cancelConnection && <button className="quiet-button" disabled={cancelling} onClick={() => void cancelConnection()}>{cancelling ? 'Stopping…' : 'Cancel sign-in'}</button>}</div>
        </div> : ready && !callbackDismissed && !params.has('error') && accounts.some(account => account.provider === params.get('connected') && account.status === 'active') && !error && <div className="connection-feedback" data-state="connected"><CheckCircle2 size={22} aria-hidden="true" /><div><strong>Account connected</strong><p>Choose which calendars to show.</p></div></div>}
      </div>
      {messages[params.get('error') || ''] && <p role="alert">{messages[params.get('error')!]}</p>}
      {setupInfo && <details className="native-setup-info"><summary>Setup for this installation</summary><p className="muted">{setupInfo.summary}</p><dl>{setupInfo.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></details>}
      {error && <p className="connection-error" role="alert">{error}</p>}
      <div className="connection-actions"><button disabled={busy || !ready || !googleReady} onClick={() => void connect({provider:'google'})}>{calendarProviders.google.connect}</button><button disabled={busy || !ready || !microsoftReady} onClick={() => { setMicrosoft(!microsoft); setApple(false); setPassword(''); setConnection(undefined); }}>{calendarProviders.microsoft.connect}</button><button disabled={busy || !ready || !icloudReady} onClick={() => { setApple(!apple); setMicrosoft(false); setPassword(''); setConnection(undefined); }}>{calendarProviders.icloud.connect}</button></div>
      {microsoft && <section className="microsoft-connect">
        <h3>Outlook & Microsoft 365</h3>
        <p className="muted">Connect Hotmail, Outlook.com, or a work or school account.</p>
        <label className="checkbox-label">
          <input type="checkbox" checked={sharedWork} onChange={e => setSharedWork(e.target.checked)} disabled={busy} />
          Include shared work calendars
        </label>
        <p className="muted">For Microsoft 365 work or school accounts. Leave off for personal Hotmail and Outlook.com accounts.</p>
        <button className="primary" disabled={busy} onClick={() => void connect({provider:'microsoft', sharedWorkCalendars: sharedWork})}>
          {busy ? 'Connecting…' : 'Continue to Microsoft'}
        </button>
      </section>}
      {ready && !microsoftReady && <p className="muted">Microsoft isn’t configured on this installation yet.</p>}
      {ready && !googleReady && <p className="muted">Google isn’t configured on this installation yet.</p>}
      {apple && <form className="icloud-connect" onSubmit={e => {
        e.preventDefault(); void connect({ provider: 'icloud', email, appPassword: password });
      }}><label>Apple ID<input type="email" autoComplete="username" disabled={busy} required value={email} onChange={e => setEmail(e.target.value)} /></label><label>App-specific password<input type="password" autoComplete="new-password" disabled={busy} required value={password} onChange={e => setPassword(e.target.value)} /></label><p className="muted">Create a password for Weekaboo in your <a href="https://account.apple.com" target="_blank" rel="noreferrer">Apple Account</a>. Use that here, rather than your usual Apple password.</p><button className="primary" disabled={busy || !password.trim()}>{busy ? 'Connecting…' : 'Connect iCloud account'}</button></form>}
      {accounts.map(account => <section className="connected-account" key={account.id}><span className="account-provider">{providerName(account.provider)}</span><h3>{account.email}</h3><p className="muted">{account.status === 'active' ? 'Connected' : 'Reconnect needed'}</p>{account.needsAttention && <p className="connection-error">{account.status === 'needs_reauth' ? 'Reconnect this account to restore calendar access.' : 'Calendar sync needs attention. Try syncing again.'}</p>}
        {pendingWrites.filter(write => write.accountId === account.id).map(write => <div className="saved-calendar-change" key={write.id}>
          <strong>{write.title}</strong><p className="muted">{write.sent ? 'We couldn’t confirm this change was saved.' : 'This change hasn’t been saved to your calendar yet.'}</p>
          <button disabled={busy} onClick={() => void resolveWrite(write.id, 'check')}>{write.sent ? 'Check again' : 'Try again'}</button>
          {dismissing === write.id ? <div className="disconnect-confirm"><p>{write.sent ? 'Dismiss this notice? Anything already saved to your calendar will stay there.' : 'Discard this draft?'}</p><button disabled={busy} onClick={() => void resolveWrite(write.id, 'dismiss')}>{write.sent ? 'Dismiss notice' : 'Discard draft'}</button><button disabled={busy} onClick={() => setDismissing(undefined)}>Keep</button></div> : <button disabled={busy} className="quiet-button" onClick={() => setDismissing(write.id)}>{write.sent ? 'Dismiss' : 'Discard'}</button>}
        </div>)}
        {removing === account.id ? <div className="disconnect-confirm"><p>Remove this account and its cached calendars from Weekaboo? Events stay in the original calendar service.</p><button disabled={busy} onClick={async () => { setBusy(true); try { await service.disconnect(account.id); setConnection(undefined); setCallbackDismissed(true); await load(); setRemoving(undefined); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Disconnect account</button><button disabled={busy} onClick={() => setRemoving(undefined)}>Keep connected</button></div> : <button className="quiet-button" disabled={busy} onClick={() => setRemoving(account.id)}>Disconnect</button>}
      </section>)}
      {ready && !accounts.length && connection?.state !== 'connecting' && <p className="muted">Your first connected account will appear here.</p>}
    </div><footer className="drawer-footer"><button disabled={busy} onClick={calendars}>Choose calendars →</button></footer>
  </dialog>;
}
