'use client';
import { useApp } from '@/lib/store';

/**
 * Who the assistant serves, by the screen the person is using:
 *  - customers (and visitors): the shopping and planning assistant
 *  - administrators, supervisors and coordinators: the vendor advisor (who stands out for a service and an area)
 *  - vendors: no assistant at all (hidden and disabled)
 */
export type LumaAccess = 'customer' | 'staff' | 'none';
export const accessForRole = (role: 'client' | 'vendor' | 'admin'): LumaAccess => (role === 'vendor' ? 'none' : role === 'admin' ? 'staff' : 'customer');
export function useLumaAccess(): LumaAccess { return accessForRole(useApp().currentRole); }
