'use client';
import { useEffect, useState } from 'react';

/** True only when this browser can actually pay with Apple Pay (HIG: don't offer it elsewhere). */
export function useApplePayAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    try {
      const session = (window as any).ApplePaySession;
      setAvailable(!!session && typeof session.canMakePayments === 'function' && !!session.canMakePayments());
    } catch {
      setAvailable(false);
    }
  }, []);
  return available;
}
