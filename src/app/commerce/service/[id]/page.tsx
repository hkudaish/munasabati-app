import Storefront from '@/components/commerce/Storefront';
export default function Page({params}:{params:{id:string}}){return <div className="max-w-6xl mx-auto p-4 sm:p-8"><Storefront serviceId={params.id}/></div>;}
