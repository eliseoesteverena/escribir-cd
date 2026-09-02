// GET  /api/letters/:id/share-links — lista los links de una carta (dueño).
// POST /api/letters/:id/share-links — crea un link nuevo para esa carta.
//
// Gestión de links: requiere sesión y ser dueño de la carta. El consumo
// público del link (sin sesión) vive aparte, en functions/api/share/[token].js.

import { getDb } from '../../../../../db/client';
import { createAuth } from '../../../../../db/auth';
import { letters, shareLinks } from '../../../../../db/schema';
import { eq, desc } from 'drizzle-orm';

const PERMISSIONS = new Set(['view', 'edit']);

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function requireSession(context) {
    const auth = createAuth(context.env);
    return auth.api.getSession({ headers: context.request.headers });
}

// Confirma que la carta :id existe y es del usuario de la sesión.
async function findOwnedLetter(context, session, db) {
    const rows = await db.select().from(letters).where(eq(letters.id, context.params.id)).limit(1);
    const letter = rows[0];
    if (!letter || letter.userId !== session.user.id) return null;
    return letter;
}

// Convierte lo que mande el cliente para expires_at (ISO string, ms number,
// o null/ausente = no expira) a un Date o null. Tira si es inválido.
// OJO: tiene que devolver un Date, no un número — las columnas
// mode:'timestamp_ms' de Drizzle llaman value.getTime() internamente al
// escribir, y eso rompe (TypeError) si value es un número plano.
function parseExpiresAt(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
    if (typeof value === 'string') {
        const ms = Date.parse(value);
        if (!Number.isNaN(ms)) return new Date(ms);
    }
    throw new Error('invalid');
}

export async function onRequestGet(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const db = getDb(context.env);
        const letter = await findOwnedLetter(context, session, db);
        if (!letter) return json({ error: 'Carta no encontrada' }, 404);

        const rows = await db
            .select()
            .from(shareLinks)
            .where(eq(shareLinks.letterId, letter.id))
            .orderBy(desc(shareLinks.createdAt));

        return json(rows);
    } catch (err) {
        console.error('[share-links:GET]', err);
        return json({ error: 'Error interno' }, 500);
    }
}

export async function onRequestPost(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const db = getDb(context.env);
        const letter = await findOwnedLetter(context, session, db);
        if (!letter) return json({ error: 'Carta no encontrada' }, 404);

        let body;
        try {
            body = await context.request.json();
        } catch {
            body = {};
        }

        const { permission, expires_at } = body ?? {};

        if (!PERMISSIONS.has(permission)) {
            return json({ error: `permission debe ser uno de: ${[...PERMISSIONS].join(', ')}` }, 400);
        }

        let expiresAt;
        try {
            expiresAt = parseExpiresAt(expires_at);
        } catch {
            return json({ error: 'expires_at inválido (usar ISO string, ms, o omitir)' }, 400);
        }

        const [inserted] = await db
            .insert(shareLinks)
            .values({
                id: crypto.randomUUID(),
                letterId: letter.id,
                token: crypto.randomUUID(),
                permission,
                expiresAt,
                createdAt: new Date(),
            })
            .returning();

        return json(inserted, 201);
    } catch (err) {
        console.error('[share-links:POST]', err);
        return json({ error: 'Error interno' }, 500);
    }
}
