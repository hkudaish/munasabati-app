'use client';
import { usePathname } from 'next/navigation';
export default function SiteChrome({children}:{children:React.ReactNode}){return usePathname().startsWith('/coverage-preview/')?null:children;}
