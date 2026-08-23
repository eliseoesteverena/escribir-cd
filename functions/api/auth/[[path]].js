import { createAuth } from '../../../db/auth';

// [[path]] = catch-all de Pages Functions: matchea /api/auth/lo-que-sea
// (sign-up/email, sign-in/email, get-session, sign-out, callback/*, etc.)
// BetterAuth maneja todas esas sub-rutas internamente vía auth.handler().
export async function onRequest(context) {
    const auth = createAuth(context.env);

    // DIAGNÓSTICO TEMPORAL — sacar una vez resuelto el 500 del signup.
    let response;
    try {
        response = await auth.handler(context.request);
    } catch (err) {
        return new Response(JSON.stringify({
            debug: true,
            stage: 'auth.handler() lanzó una excepción sin capturar',
            error: String((err && err.stack) || err),
            cause: err && err.cause ? String(err.cause) : null,
        }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    if (response.status >= 500) {
        const bodyText = await response.clone().text().catch(() => '(no se pudo leer)');
        return new Response(JSON.stringify({
            debug: true,
            stage: `auth.handler() no tiró excepción, pero devolvió status ${response.status}`,
            originalStatus: response.status,
            originalBody: bodyText,
            originalHeaders: Object.fromEntries(response.headers.entries()),
        }, null, 2), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    return response;
}
