import { createAuth } from '../../../db/auth';

// [[path]] = catch-all de Pages Functions: matchea /api/auth/lo-que-sea
// (sign-up/email, sign-in/email, session, sign-out, callback/*, etc.)
// BetterAuth maneja todas esas sub-rutas internamente vía auth.handler().
export async function onRequest(context) {
    const auth = createAuth(context.env);
    const response = await auth.handler(context.request);

    // DIAGNÓSTICO TEMPORAL — sacar una vez resuelto el 404.
    // Si BetterAuth devuelve 404, distinguimos entre "Cloudflare nunca
    // ejecutó esta función" (no vamos a ver este JSON) y "la función SÍ
    // corrió, pero BetterAuth no reconoce la ruta internamente" (vemos
    // este JSON con debug:true).
    if (response.status === 404) {
        const url = new URL(context.request.url);
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
