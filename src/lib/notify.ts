export type NotifyKind = 'error' | 'success' | 'info';

export const NOTIFY_EVENT = 'app:notify';

/** Non-blocking replacement for window.alert; rendered by <Toaster />. */
export function notify(message: string, kind: NotifyKind = 'error') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFY_EVENT, { detail: { message, kind } }));
}
