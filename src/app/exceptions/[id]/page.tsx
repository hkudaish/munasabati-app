import ExceptionDetail from '@/components/exceptions/ExceptionDetail';
export const dynamic = 'force-dynamic';
export default async function ExceptionPage({ params }: { params: Promise<{ id: string }> }) { return <ExceptionDetail id={(await params).id} />; }
