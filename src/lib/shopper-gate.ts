'use client';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { requestJSON } from '@/lib/api-client';

/**
 * Browsing and shopping stay open to everyone. Opening the cart (or adding to it) needs an account:
 * ask the visitor to sign in or sign up, then bring them back to where they were.
 * Use as: onClick={e => gate(e, '/commerce/cart')}
 */
export function useCartGate() {
  const { currentUser, openOnboarding } = useApp();
  const router = useRouter();
  return async (event: MouseEvent, href: string) => {
    if (currentUser) return; // signed in: let the link work normally
    event.preventDefault();
    let signedIn = false;
    try { signedIn = !!(await requestJSON('/api/auth/session')).user; } catch { /* treat as signed out */ }
    if (signedIn) { router.push(href); return; } // session existed; the profile had not loaded yet
    openOnboarding('client', { gate: true, returnTo: href });
  };
}
