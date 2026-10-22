import Storefront from '@/components/commerce/Storefront';
import ServicesJsonLd from '@/components/seo/ServicesJsonLd';

export const dynamic = 'force-dynamic';
export default function Page() { return <div className="max-w-6xl mx-auto p-4 sm:p-8"><ServicesJsonLd /><Storefront /></div>; }
