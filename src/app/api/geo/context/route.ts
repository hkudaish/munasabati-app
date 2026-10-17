import { api } from '@/lib/server/http';
import { geoContext } from '@/lib/server/geo/context';
export const dynamic='force-dynamic';
export const GET=api(async()=>geoContext());
