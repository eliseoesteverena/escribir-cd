import { createAuth } from '../../../db/auth';

// [[path]] = catch-all de Pages Functions: matchea /api/auth/lo-que-sea
// (sign-up/email, sign-in/email, get-session, sign-out, callback/*, etc.)
// BetterAuth maneja todas esas sub-rutas internamente vía auth.handler().
export async function onRequest(context) {
    // DIAGNÓSTICO TEMPORAL — captura los logs internos de BetterAuth
    // (nivel debug, ver db/auth.ts) para devolverlos si algo falla.
    const logs = [];
    const auth = createAuth(context.env, { onLog: (line) => logs.push(line) });

    let response;
    try {
        response = await auth.handler(context.request);
    } catch (err) {
        return new Response(JSON.stringify({
            debug: true,
            stage: 'auth.handler() lanzó una excepción sin capturar',
            error: String((err && err.stack) || err),
            cause: err && err.cause ? String(err.cause) : null,
            logs,
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
            logs,
        }, null, 2), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    return response;
}
