import { createAuth } from '../../../db/auth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

// [[path]] = catch-all de Pages Functions: matchea /api/auth/lo-que-sea
// (sign-up/email, sign-in/email, session, sign-out, callback/*, etc.)
// BetterAuth maneja todas esas sub-rutas internamente vía auth.handler().
export async function onRequest(context) {
    const url = new URL(context.request.url);

    // ============================================================
    // DIAGNÓSTICO PROFUNDO: agregar ?fulldebug=1 a cualquier URL de
    // /api/auth/* corre una batería completa de chequeos y pruebas.
    // ============================================================
    if (url.searchParams.has('fulldebug')) {
        return runFullDiagnostic(context, url);
    }

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
        const bodyText = await response.clone().text().catch(() => '(no se pudo leer)');
        return new Response(JSON.stringify({
            debug: true,
            message: 'La función se ejecutó. BetterAuth devolvió 404 internamente. Para el diagnóstico completo: agregar ?fulldebug=1 a esta URL.',
            path: url.pathname,
            responseBody: bodyText,
        }, null, 2), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return response;
}

async function runFullDiagnostic(context, url) {
    const report = { steps: [] };
    const log = (label, data) => report.steps.push({ label, ...data });

    // --- Lo más básico primero ---
    log('1. env.BETTER_AUTH_URL', { value: context.env.BETTER_AUTH_URL || null });
    log('2. env.BETTER_AUTH_SECRET', {
        present: Boolean(context.env.BETTER_AUTH_SECRET),
        length: context.env.BETTER_AUTH_SECRET ? context.env.BETTER_AUTH_SECRET.length : 0,
    });
    log('3. env.DB binding', { present: Boolean(context.env.DB), type: typeof context.env.DB });
    log('4. typeof betterAuth (import)', { value: typeof betterAuth });
    log('5. typeof drizzleAdapter (import)', { value: typeof drizzleAdapter });

    // --- Construcción del objeto auth ---
    let auth;
    try {
        auth = createAuth(context.env);
        log('6. createAuth()', { ok: true });
    } catch (err) {
        log('6. createAuth()', { ok: false, error: String((err && err.stack) || err) });
        return new Response(JSON.stringify(report, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // --- Forma exacta del objeto auth ---
    log('7. Object.keys(auth)', { keys: Object.keys(auth) });
    log('8. typeof auth.handler', { value: typeof auth.handler });
    log('9. typeof auth.api', { value: typeof auth.api });

    try {
        log('10. Object.keys(auth.api)', { keys: auth.api ? Object.keys(auth.api) : null });
    } catch (err) {
        log('10. Object.keys(auth.api)', { error: String(err) });
    }

    try {
        log('11. auth.options resuelto (config final que ve BetterAuth)', {
            baseURL: auth.options ? auth.options.baseURL : '(no existe la propiedad .options)',
            basePath: auth.options ? auth.options.basePath : '(no existe la propiedad .options)',
        });
    } catch (err) {
        log('11. auth.options resuelto', { error: String(err) });
    }

    // --- Bypass del router HTTP: llamada directa a la API ---
    try {
        const session = await auth.api.getSession({ headers: context.request.headers });
        log('12. auth.api.getSession() directo (bypass HTTP)', { ok: true, session });
    } catch (err) {
        log('12. auth.api.getSession() directo (bypass HTTP)', { ok: false, error: String((err && err.stack) || err) });
    }

    // --- Batería de requests sintéticas contra auth.handler ---
    const origin = url.origin;
    const testCases = [
        { label: '13. GET /api/auth/session — request original de Cloudflare (context.request)', request: context.request },
        { label: '14. GET /api/auth/session — Request reconstruida a mano (new Request)', request: new Request(`${origin}/api/auth/session`, { method: 'GET' }) },
        { label: '15. GET /api/auth — raíz del basePath, sin sub-ruta', request: new Request(`${origin}/api/auth`, { method: 'GET' }) },
        { label: '16. GET /api/auth/ — raíz con barra final', request: new Request(`${origin}/api/auth/`, { method: 'GET' }) },
        { label: '17. GET /api/auth/ok — ruta inventada (control: acá SÍ debería ser 404 real)', request: new Request(`${origin}/api/auth/ok`, { method: 'GET' }) },
        {
            label: '18. POST /api/auth/sign-up/email — body vacío, solo para ver si matchea la ruta (sin escribir en la DB)',
            request: new Request(`${origin}/api/auth/sign-up/email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }),
        },
    ];

    for (const testCase of testCases) {
        try {
            const res = await auth.handler(testCase.request);
            let bodyText;
            try {
                bodyText = await res.clone().text();
            } catch (e) {
                bodyText = `(no se pudo leer el body: ${e})`;
            }
            log(testCase.label, {
                status: res.status,
                contentType: res.headers.get('content-type'),
                body: bodyText.slice(0, 400),
            });
        } catch (err) {
            log(testCase.label, { threw: true, error: String((err && err.stack) || err) });
        }
    }

    return new Response(JSON.stringify(report, null, 2), {
        headers: { 'Content-Type': 'application/json' },
    });
}
