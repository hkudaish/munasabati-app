import { api } from '@/lib/server/http';
import { geoContext,visitorId } from '@/lib/server/geo/context';
import { recordGeoEvent } from '@/lib/server/geo/metrics';
export const POST=api(async()=>{const d=await geoContext();if(d.snapshot.policy.analyticsEnabled)await recordGeoEvent('VISIT',d.selection.cityId,d.selection.countryCode,'all',await visitorId(true));return {success:true};});
