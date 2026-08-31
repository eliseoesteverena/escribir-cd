// =============================================================
// HELPERS DE AUTENTICACIÓN (BetterAuth vía fetch directo)
// =============================================================
// Mismo origen, así que las cookies de sesión viajan solas con fetch()
// (modo 'same-origin' es el default) — no hace falta el SDK cliente.
// Endpoints confirmados en la Fase 2: /api/auth/get-session,
// /api/auth/sign-up/email, /api/auth/sign-in/email, /api/auth/sign-out.

async function authGetSession() {
    try {
        // cache: 'no-store' es importante: sin esto, el navegador puede
        // devolver una respuesta vieja (por ejemplo "logueado") justo
        // después de cerrar sesión, dando la impresión de que el logout
        // no funcionó cuando en realidad sí funcionó server-side.
        const res = await fetch('/api/auth/get-session', { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return data; // { session, user } o null si no hay sesión
    } catch (err) {
        console.error('Error consultando la sesión:', err);
        return null;
    }
}

function extractErrorDetail(data) {
    let detail;
    if (data.originalBody) {
        try {
            const inner = JSON.parse(data.originalBody);
            detail = (inner && inner.message) || data.originalBody;
        } catch {
            detail = data.originalBody;
        }
    } else {
        detail = data.message || data.error || data.stage || JSON.stringify(data);
    }

    if (Array.isArray(data.logs) && data.logs.length) {
        detail += '\n\n--- logs de BetterAuth ---\n' + data.logs.join('\n');
    }

    return detail;
}

async function authSignUpEmail({ name, email, password }) {
    const res = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`${extractErrorDetail(data)} (status ${res.status})`);
    }
    return data;
}

async function authSignInEmail({ email, password }) {
    const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`${extractErrorDetail(data)} (status ${res.status})`);
    }
    return data;
}

async function authSignOut() {
    try {
        const res = await fetch('/api/auth/sign-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: '{}',
        });
        if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            console.error('Sign-out respondió', res.status, bodyText);
        }
    } catch (err) {
        console.error('Error cerrando sesión:', err);
    }
    // No confiamos en cachés intermedias: forzamos recarga completa en vez
    // de una navegación que el navegador podría servir desde bfcache.
    window.location.replace('index.html');
}