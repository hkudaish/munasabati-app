import { cookies } from 'next/headers';
import { api,body } from '@/lib/server/http';
import { assertNotPreview } from '@/lib/server/geo/context';
import { getCart,saveCart } from '@/lib/server/commerce-v2/cart';
export const dynamic='force-dynamic';
export const GET=api(()=>getCart(),{allowDisabledFeature:true});
export const PUT=api(async request=>{await assertNotPreview(request);return saveCart(await body(request,180000),(await cookies()).get('locale')?.value);});
