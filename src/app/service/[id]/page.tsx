'use client';
import {useParams,usePathname} from 'next/navigation';
import Storefront from '@/components/commerce/Storefront';
export default function ServicePage(){const route=useParams(),path=usePathname().split('/');const id=(route?.id as string)||(path[1]==='coverage-preview'?path[path.length-1]:'');return <div className="max-w-6xl mx-auto p-4 sm:p-8"><Storefront serviceId={id}/></div>;}
