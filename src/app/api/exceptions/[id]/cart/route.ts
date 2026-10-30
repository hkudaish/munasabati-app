import { api } from '@/lib/server/http';
import { addApprovedToCart } from '@/lib/server/exceptions/actions';
export const dynamic = 'force-dynamic';
// Puts the approved booking in the customer's own cart, tied to the exception. The cart re-checks the approval and the agreed price on the server.
export const POST = api(async (_request, context) => addApprovedToCart((await context.params).id));
