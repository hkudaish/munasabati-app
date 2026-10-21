'use client';
import { Fragment, type ReactNode } from 'react';
import { useApp } from '@/lib/store';

/** After a sign-out its children start fresh, so no component keeps the previous account's local state. */
export default function SessionBoundary({ children }: { children: ReactNode }) {
  const { signOutEpoch } = useApp();
  return <Fragment key={signOutEpoch}>{children}</Fragment>;
}
