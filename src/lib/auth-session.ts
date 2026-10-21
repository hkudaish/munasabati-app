'use client';

/**
 * Client-side session plumbing shared by every role (customer, vendor, administrator):
 *  - one signed-out signal that reaches every open tab,
 *  - a server-side revoke that is retried until it succeeds (the UI never waits for it),
 *  - the list of pages that require an account.
 */

const PENDING_KEY = 'munasabati_logout_pending'; // set while the server session may still be alive
const SIGNAL_KEY = 'munasabati_auth_signal'; // storage-event fallback for browsers without BroadcastChannel
const CHANNEL = 'munasabati-auth';

export type AuthSignal = 'logout' | 'login';

// ---- Protected pages -------------------------------------------------------------------------
const PROTECTED_PREFIXES = ['/admin', '/system-admin', '/bookings', '/occasion', '/settings', '/reception-screen', '/scan', '/commerce/orders', '/commerce/manage'];
const PROTECTED_EXACT = ['/vendor', '/vendor/catalog', '/vendor/orders']; // /vendor/[id] is a public profile

export function isProtectedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PROTECTED_EXACT.includes(path) || PROTECTED_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '/'));
}

// ---- Cross-tab signal ------------------------------------------------------------------------
let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  try {
    if (!channel && typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(CHANNEL);
  } catch { channel = null; }
  return channel;
}

export function broadcastAuth(signal: AuthSignal) {
  try { getChannel()?.postMessage({ signal, at: Date.now() }); } catch { /* ignore */ }
  try { localStorage.setItem(SIGNAL_KEY, signal + ':' + Date.now()); } catch { /* storage unavailable */ }
}

/** Calls back when ANOTHER tab signs out or in. Returns an unsubscribe function. */
export function subscribeAuth(onSignal: (signal: AuthSignal) => void): () => void {
  let last = 0;
  const deliver = (signal: AuthSignal, at: number) => {
    if (at && at === last) return; // BroadcastChannel and storage event may both fire for one signal
    last = at;
    onSignal(signal);
  };
  const ch = getChannel();
  const onMessage = (event: MessageEvent) => {
    const data = event.data;
    if (data && (data.signal === 'logout' || data.signal === 'login')) deliver(data.signal, data.at);
  };
  ch?.addEventListener('message', onMessage);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SIGNAL_KEY || !event.newValue) return;
    const [signal, at] = event.newValue.split(':');
    if (signal === 'logout' || signal === 'login') deliver(signal, Number(at) || 0);
  };
  window.addEventListener('storage', onStorage);
  return () => { ch?.removeEventListener('message', onMessage); window.removeEventListener('storage', onStorage); };
}

// ---- Server revoke with recovery -------------------------------------------------------------
export function isRevokePending(): boolean {
  try { return localStorage.getItem(PENDING_KEY) === '1'; } catch { return false; }
}
function setRevokePending(on: boolean) {
  try { if (on) localStorage.setItem(PENDING_KEY, '1'); else localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

/** One attempt to end the session on the server. Never throws. */
export async function revokeServerSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true, // lets the request finish even while the page is being left
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (response.ok) { setRevokePending(false); return true; }
  } catch { /* offline or server down */ }
  return false;
}

const RETRY_DELAYS_MS = [2000, 5000, 15000, 60000, 300000];
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryListenerAttached = false;

/**
 * Marks the server session as "still to revoke", tries now, and keeps retrying (backoff, and again as soon as the
 * browser is back online) until the server confirms. The UI is already signed out before this runs.
 */
export function revokeWithRecovery(onStillPending?: () => void): void {
  setRevokePending(true);
  let attempt = 0;
  const run = async () => {
    retryTimer = null;
    if (!isRevokePending()) return; // another tab already finished it
    if (await revokeServerSession()) return;
    if (attempt === 0) onStillPending?.();
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
    attempt += 1;
    retryTimer = setTimeout(run, delay);
  };
  if (!retryListenerAttached && typeof window !== 'undefined') {
    retryListenerAttached = true;
    window.addEventListener('online', () => { if (isRevokePending()) { if (retryTimer) clearTimeout(retryTimer); void run(); } });
  }
  if (retryTimer) clearTimeout(retryTimer);
  void run();
}
