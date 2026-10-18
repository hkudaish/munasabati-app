'use client';
import {useParams,usePathname} from 'next/navigation';
import Storefront from '@/components/commerce/Storefront';
export default function ServicePage({params}:{params?:{id:string}}){const route=useParams(),path=usePathname().split('/');const id=params?.id||(route?.id as string)||(path[1]==='coverage-preview'?path[path.length-1]:'');return <main className="max-w-6xl mx-auto p-4 sm:p-8"><Storefront serviceId={id}/></main>;}
