// =============================================================
// HELPERS DE AUTENTICACIÓN (BetterAuth vía fetch directo)
// =============================================================
// Mismo origen, así que las cookies de sesión viajan solas con fetch()
// (modo 'same-origin' es el default) — no hace falta el SDK cliente.
// Endpoints confirmados en la Fase 2: /api/auth/get-session,
// /api/auth/sign-up/email, /api/auth/sign-in/email, /api/auth/sign-out.

async function authGetSession() {
    try {
        const res = await fetch('/api/auth/get-session');
        if (!res.ok) return null;
        const data = await res.json();
        return data; // { session, user } o null si no hay sesión
    } catch (err) {
        console.error('Error consultando la sesión:', err);
        return null;
    }
}

async function authSignUpEmail({ name, email, password }) {
    const res = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `No se pudo crear la cuenta (${res.status})`);
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
        throw new Error(data.message || `No se pudo iniciar sesión (${res.status})`);
    }
    return data;
}

async function authSignOut() {
    try {
        await fetch('/api/auth/sign-out', { method: 'POST' });
    } catch (err) {
        console.error('Error cerrando sesión:', err);
    }
    window.location.href = 'index.html';
}
