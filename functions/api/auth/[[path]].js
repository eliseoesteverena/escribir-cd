import { createAuth } from '../../../db/auth';

// [[path]] = catch-all de Pages Functions: matchea /api/auth/lo-que-sea
// (sign-up/email, sign-in/email, session, sign-out, callback/*, etc.)
// BetterAuth maneja todas esas sub-rutas internamente vía auth.handler().
export async function onRequest(context) {
    let auth;
    try {
        auth = createAuth(context.env);
    } catch (err) {
        return new Response(JSON.stringify({
            debug: true,
            stage: 'createAuth() lanzó una excepción',
            error: String((err && err.stack) || err),
        }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(context.request.url);

    // DIAGNÓSTICO: /api/auth/session?direct=1 bypasea el router HTTP de
    // auth.handler y llama a la API de BetterAuth directamente. Si esto
    // funciona pero auth.handler sigue en 404, el problema es específico
    // del ruteo HTTP interno (basePath/baseURL), no de cómo se construye auth.
    if (url.searchParams.has('direct')) {
        try {
            const session = await auth.api.getSession({ headers: context.request.headers });
            return new Response(JSON.stringify({
                debug: true, via: 'auth.api.getSession (bypass)', session,
            }, null, 2), { headers: { 'Content-Type': 'application/json' } });
        } catch (err) {
            return new Response(JSON.stringify({
                debug: true, via: 'auth.api.getSession (bypass)',
                error: String((err && err.stack) || err),
            }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    let response;
    try {
        response = await auth.handler(context.request);
    } catch (err) {
        return new Response(JSON.stringify({
            debug: true,
            stage: 'auth.handler() lanzó una excepción',
            error: String((err && err.stack) || err),
        }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // DIAGNÓSTICO TEMPORAL — sacar una vez resuelto el 404.
    if (response.status === 404) {
        return new Response(JSON.stringify({
            debug: true,
            message: 'La función se ejecutó. BetterAuth devolvió 404 internamente.',
            path: url.pathname,
            params: context.params,
            env_check: {
                BETTER_AUTH_URL: context.env.BETTER_AUTH_URL || '(no configurada)',
                BETTER_AUTH_SECRET: context.env.BETTER_AUTH_SECRET
                    ? `configurada (${context.env.BETTER_AUTH_SECRET.length} caracteres)`
                    : '(no configurada)',
            },
        }, null, 2), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return response;
}
