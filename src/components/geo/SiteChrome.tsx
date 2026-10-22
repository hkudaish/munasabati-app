'use client';
import { useInnerPathname } from '@/components/i18n/LocaleProvider';
export default function SiteChrome({children}:{children:React.ReactNode}){return useInnerPathname().startsWith('/coverage-preview/')?null:children;}
