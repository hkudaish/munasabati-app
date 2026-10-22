import ServiceLayout from '@/components/system/ServiceLayout';
import ServicesJsonLd from '@/components/seo/ServicesJsonLd';
export const dynamic = 'force-dynamic';
export default function Layout({ children }: { children: React.ReactNode }) { return <ServiceLayout id="marketplace"><ServicesJsonLd />{children}</ServiceLayout>; }
