import { createAuth } from '../../../db/auth';

// [[path]] = catch-all de Pages Functions: matchea /api/auth/lo-que-sea
// (sign-up/email, sign-in/email, session, sign-out, callback/*, etc.)
// BetterAuth maneja todas esas sub-rutas internamente vía auth.handler().
export async function onRequest(context) {
    const auth = createAuth(context.env);
    return auth.handler(context.request);
}
